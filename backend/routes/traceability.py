from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any
from datetime import datetime

from database import get_db
import models
from services.traceability_service import (
    build_traceability_graph,
    search_traceability_entities,
    init_shipment_milestones,
    sync_milestones_from_shipment_actions
)

router = APIRouter(tags=["Traceability & Operational Tracking"])

@router.get("/api/v1/traceability/search")
def search_entities(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """Global search across Shipments, Customers, Vendors, Products, POs, Invoices."""
    return search_traceability_entities(db, q)


@router.get("/api/v1/traceability/{entity_type}/{entity_id}")
def get_traceability_tree(entity_type: str, entity_id: int, db: Session = Depends(get_db)):
    """Retrieves the complete dynamic relationship graph for any entity."""
    res = build_traceability_graph(db, entity_type, entity_id)
    if "error" in res:
        raise HTTPException(status_code=404, detail=res["error"])
    return res


@router.get("/api/v1/tracking/dashboard")
def get_tracking_dashboard(db: Session = Depends(get_db)):
    """Returns operational tracking summary KPIs and shipment tracking list."""
    shipments = db.query(models.Shipment).filter(models.Shipment.is_deleted == False).order_by(models.Shipment.id.desc()).all()

    total_shipments = len(shipments)
    in_progress = 0
    completed = 0
    blocked = 0
    delayed = 0
    attention_required = 0

    shipment_rows = []

    for s in shipments:
        sync_milestones_from_shipment_actions(db, s)
        ms_list = s.milestones
        if not ms_list:
            ms_list = init_shipment_milestones(db, s.id)

        ms_total = len(ms_list)
        ms_completed = sum(1 for m in ms_list if m.status == "COMPLETED")
        ms_blocked = sum(1 for m in ms_list if m.status == "BLOCKED")

        is_delayed = any((m.delay_days or 0) > 0 for m in ms_list)
        if is_delayed:
            delayed += 1

        if ms_blocked > 0:
            blocked += 1
            attention_required += 1

        if s.status == "COMPLETED" or (ms_total > 0 and ms_completed == ms_total):
            completed += 1
        elif s.status != "CANCELLED":
            in_progress += 1

        # Determine current milestone name
        current_ms_name = s.current_stage or "SHIPMENT_CREATION"
        for m in ms_list:
            if m.status in ["IN_PROGRESS", "PENDING"]:
                current_ms_name = f"Step {m.sequence}: {m.milestone_name}"
                break

        cust_names = [sc.customer.name for sc in s.customers if sc.customer]
        cust_str = ", ".join(cust_names) if cust_names else "Unassigned Customer"

        progress_pct = round((ms_completed / ms_total * 100.0), 1) if ms_total > 0 else 0.0

        shipment_rows.append({
            "shipment_id": s.id,
            "shipment_no": s.shipment_no,
            "financial_year": s.financial_year,
            "customer_names": cust_str,
            "destination": s.destination,
            "status": s.status,
            "current_stage": current_ms_name,
            "progress_pct": progress_pct,
            "total_milestones": ms_total,
            "completed_milestones": ms_completed,
            "is_delayed": is_delayed,
            "is_blocked": ms_blocked > 0,
            "created_at": s.created_at.isoformat() if s.created_at else None
        })

    return {
        "kpis": {
            "total_shipments": total_shipments,
            "in_progress": in_progress,
            "completed": completed,
            "blocked": blocked,
            "delayed": delayed,
            "attention_required": attention_required
        },
        "shipments": shipment_rows
    }


def _format_milestone(m: models.ShipmentMilestone) -> Dict[str, Any]:
    return {
        "id": m.id,
        "shipment_id": m.shipment_id,
        "milestone_code": m.milestone_code,
        "milestone_name": m.milestone_name,
        "sequence": m.sequence,
        "status": m.status,
        "workflow_mode": m.workflow_mode,
        "planned_date": m.planned_date.isoformat() if m.planned_date else None,
        "due_date": m.due_date.isoformat() if m.due_date else None,
        "actual_date": m.actual_date.isoformat() if m.actual_date else None,
        "delay_days": m.delay_days or 0,
        "delay_reason": m.delay_reason,
        "owner_person": m.owner_person or "Operations Manager",
        "remarks": m.remarks,
        "source_entity_type": m.source_entity_type,
        "source_entity_id": m.source_entity_id
    }


@router.get("/api/v1/shipments/{shipment_id}/milestones")
def get_shipment_milestones(shipment_id: int, db: Session = Depends(get_db)):
    """Returns operational tracking milestones for a specific shipment."""
    s = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    sync_milestones_from_shipment_actions(db, s)
    milestones = db.query(models.ShipmentMilestone).filter(
        models.ShipmentMilestone.shipment_id == shipment_id
    ).order_by(models.ShipmentMilestone.sequence.asc()).all()

    if not milestones:
        milestones = init_shipment_milestones(db, shipment_id)

    return [_format_milestone(m) for m in milestones]


@router.post("/api/v1/shipments/{shipment_id}/milestones/init")
def reset_shipment_milestones(shipment_id: int, workflow_mode: str = "SEA_FCL", db: Session = Depends(get_db)):
    """Resets/initializes milestone template for a shipment."""
    s = db.query(models.Shipment).filter(models.Shipment.id == shipment_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Shipment not found")

    db.query(models.ShipmentMilestone).filter(models.ShipmentMilestone.shipment_id == shipment_id).delete()
    db.commit()

    created = init_shipment_milestones(db, shipment_id, workflow_mode)
    sync_milestones_from_shipment_actions(db, s)
    return [_format_milestone(m) for m in created]


@router.put("/api/v1/shipments/{shipment_id}/milestones/{milestone_id}")
def update_shipment_milestone(
    shipment_id: int,
    milestone_id: int,
    payload: Dict[str, Any],
    db: Session = Depends(get_db)
):
    """Updates a milestone's status, dates, delay days, or remarks."""
    m = db.query(models.ShipmentMilestone).filter(
        models.ShipmentMilestone.id == milestone_id,
        models.ShipmentMilestone.shipment_id == shipment_id
    ).first()

    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")

    if "status" in payload:
        m.status = str(payload["status"]).upper()
        if m.status == "COMPLETED" and not m.actual_date:
            m.actual_date = datetime.utcnow()

    if "delay_days" in payload:
        m.delay_days = int(payload["delay_days"] or 0)

    if "delay_reason" in payload:
        m.delay_reason = payload["delay_reason"]

    if "owner_person" in payload:
        m.owner_person = payload["owner_person"]

    if "remarks" in payload:
        m.remarks = payload["remarks"]

    db.commit()
    db.refresh(m)

    # Log action in shipment activity log
    log = models.ShipmentActivityLog(
        shipment_id=shipment_id,
        stage_name=m.milestone_name,
        action_type="MILESTONE_UPDATE",
        action_title=f"Milestone '{m.milestone_name}' set to {m.status}",
        details=m.remarks or m.delay_reason
    )
    db.add(log)
    db.commit()

    return _format_milestone(m)
