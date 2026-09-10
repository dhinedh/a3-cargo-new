from fastapi import APIRouter, Depends, HTTPException, Query
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
import models
import schemas

router = APIRouter(prefix="/api/v1/vendors", tags=["Vendors"])

@router.get("", response_model=List[schemas.VendorResponse])
def list_vendors(
    q: Optional[str] = Query(None, description="Search vendor by name or code"),
    db: Session = Depends(get_db)
):
    query = db.query(models.Vendor)
    if q:
        clean_q = q.strip()
        query = query.filter(
            models.Vendor.name.ilike(f"%{clean_q}%") |
            models.Vendor.code.ilike(f"%{clean_q}%") |
            models.Vendor.legal_name.ilike(f"%{clean_q}%") |
            models.Vendor.trade_name.ilike(f"%{clean_q}%")
        )
    return query.order_by(models.Vendor.name).all()

@router.get("/products/all", response_model=List[str])
def search_all_products(
    q: Optional[str] = Query(None, description="Search product prefix or term"),
    db: Session = Depends(get_db)
):
    products_set = set()

    # 1. Default popular products catalog
    popular_defaults = [
        "Ragi", "Maida", "Atta (Wheat Flour)", "Turmeric Powder", "Black Pepper",
        "White Sugar", "Urad Dal", "Toor Dal", "Chana Dal", "Cardamom",
        "Coriander Seeds", "Mustard Seeds", "Refined Sunflower Oil", "Coconut Oil",
        "Basmati Rice", "Raw Cashew Nuts", "Cloves", "Cinnamon", "Red Chilli"
    ]
    for p in popular_defaults:
        products_set.add(p)

    # 2. Products registered by vendors
    all_vendors = db.query(models.Vendor).all()
    for v in all_vendors:
        if v.products_supplied:
            for item in v.products_supplied:
                if item and item.strip():
                    products_set.add(item.strip())

    # 3. Customer Requirement products saved in database
    reqs = db.query(models.ShipmentCustomerRequirement).all()
    for r in reqs:
        if r.product_name and r.product_name.strip():
            products_set.add(r.product_name.strip())

    # 4. Master Item Entries from Database (all seeded products from Excel catalog)
    items = db.query(models.ItemEntry).all()
    for it in items:
        if it.item_name and it.item_name.strip():
            products_set.add(it.item_name.strip())

    all_prods = list(products_set)

    if q and q.strip():
        clean_q = q.strip().lower()
        # Sort priority: starts with > contains
        prefix_matches = [p for p in all_prods if p.lower().startswith(clean_q)]
        other_matches = [p for p in all_prods if clean_q in p.lower() and not p.lower().startswith(clean_q)]
        result_list = sorted(prefix_matches) + sorted(other_matches)
    else:
        result_list = sorted(all_prods)

    return result_list[:50]

@router.get("/matching-for-product", response_model=schemas.VendorProductMatchResponse)
def match_vendors_for_product(
    product_name: str = Query(..., description="Product name to match vendors for"),
    db: Session = Depends(get_db)
):
    clean_p = product_name.strip().lower()
    all_vendors = db.query(models.Vendor).order_by(models.Vendor.name).all()

    matching = []
    for v in all_vendors:
        supplied = [p.lower() for p in (v.products_supplied or [])]
        sub_cats = [sc.lower() for sc in (v.sub_categories or [])]

        is_match = False
        if any(clean_p in item or item in clean_p for item in supplied):
            is_match = True
        elif any(clean_p in item or item in clean_p for item in sub_cats):
            is_match = True
        elif v.main_category and (clean_p in v.main_category.lower() or v.main_category.lower() in clean_p):
            is_match = True

        if is_match:
            matching.append(v)

    last_alloc = db.query(models.ShipmentVendorAllocation)\
        .join(models.ShipmentCustomerRequirement)\
        .filter(models.ShipmentCustomerRequirement.product_name.ilike(f"%{clean_p}%"))\
        .order_by(models.ShipmentVendorAllocation.id.desc())\
        .first()

    last_vendor = None
    if last_alloc:
        last_vendor = db.query(models.Vendor).filter(models.Vendor.id == last_alloc.vendor_id).first()

    return {
        "product_name": product_name,
        "last_allocated_vendor": last_vendor,
        "matching_vendors": matching,
        "all_vendors": all_vendors
    }

@router.post("", response_model=schemas.VendorResponse)
def create_vendor(payload: schemas.VendorCreate, db: Session = Depends(get_db)):
    if payload.code and payload.code.strip():
        clean_code = payload.code.strip().upper()
    else:
        count = db.query(models.Vendor).count() + 1
        words = payload.name.strip().split()
        name_part = "".join([w[0] for w in words if w]).upper()[:3] if words else "VEND"
        if len(name_part) < 2:
            name_part = "VEND"
        clean_code = f"{name_part}-{count:03d}"

    existing = db.query(models.Vendor).filter(models.Vendor.code == clean_code).first()
    if existing:
        count = db.query(models.Vendor).count() + 1
        clean_code = f"VEND-{count:04d}"

    v = models.Vendor(
        name=payload.name.strip(),
        code=clean_code,
        legal_name=payload.legal_name,
        trade_name=payload.trade_name,
        company_type=payload.company_type or "Proprietorship",
        contact_person=payload.contact_person,
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        country=payload.country or "India",
        gstin=payload.gstin,
        pan_number=payload.pan_number,
        bank_account_number=payload.bank_account_number,
        bank_ifsc_code=payload.bank_ifsc_code,
        bank_name=payload.bank_name,
        bank_branch=payload.bank_branch,
        main_category=payload.main_category,
        sub_categories=payload.sub_categories or [],
        products_supplied=payload.products_supplied or [],
        status=payload.status or "Active Supplier"
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v

@router.put("/{vendor_id}", response_model=schemas.VendorResponse)
def update_vendor(vendor_id: int, payload: schemas.VendorUpdate, db: Session = Depends(get_db)):
    v = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")

    if payload.name is not None:
        v.name = payload.name.strip()
    if payload.code is not None:
        clean_code = payload.code.strip().upper()
        if clean_code != v.code:
            dup = db.query(models.Vendor).filter(models.Vendor.code == clean_code).first()
            if dup:
                raise HTTPException(status_code=400, detail=f"Vendor code '{clean_code}' is already used by another vendor")
            v.code = clean_code
    if payload.legal_name is not None:
        v.legal_name = payload.legal_name
    if payload.trade_name is not None:
        v.trade_name = payload.trade_name
    if payload.company_type is not None:
        v.company_type = payload.company_type
    if payload.contact_person is not None:
        v.contact_person = payload.contact_person
    if payload.email is not None:
        v.email = payload.email
    if payload.phone is not None:
        v.phone = payload.phone
    if payload.address is not None:
        v.address = payload.address
    if payload.country is not None:
        v.country = payload.country
    if payload.gstin is not None:
        v.gstin = payload.gstin
    if payload.pan_number is not None:
        v.pan_number = payload.pan_number
    if payload.bank_account_number is not None:
        v.bank_account_number = payload.bank_account_number
    if payload.bank_ifsc_code is not None:
        v.bank_ifsc_code = payload.bank_ifsc_code
    if payload.bank_name is not None:
        v.bank_name = payload.bank_name
    if payload.bank_branch is not None:
        v.bank_branch = payload.bank_branch
    if payload.main_category is not None:
        v.main_category = payload.main_category
    if payload.sub_categories is not None:
        v.sub_categories = payload.sub_categories
    if payload.products_supplied is not None:
        v.products_supplied = payload.products_supplied
    if payload.status is not None:
        v.status = payload.status

    db.commit()
    db.refresh(v)
    return v

@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: int, db: Session = Depends(get_db)):
    v = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")

    db.delete(v)
    db.commit()
    return {"message": "Vendor deleted successfully"}

@router.post("/{vendor_id}/mappings", response_model=schemas.VendorProductMappingResponse)
def add_vendor_mapping(vendor_id: int, payload: schemas.VendorProductMappingCreate, db: Session = Depends(get_db)):
    v = db.query(models.Vendor).filter(models.Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vendor not found")

    m = models.VendorProductMapping(
        vendor_id=vendor_id,
        product_category=payload.product_category.strip(),
        notes=payload.notes
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m
