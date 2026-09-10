from fastapi import APIRouter, Depends, HTTPException
# pyrefly: ignore [missing-import]
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Customer
from schemas import CustomerCreate, CustomerUpdate, CustomerResponse

router = APIRouter(prefix="/api/v1/customers", tags=["Customers"])

@router.get("", response_model=List[CustomerResponse])
def get_customers(db: Session = Depends(get_db)):
    return db.query(Customer).order_by(Customer.name.asc()).all()

@router.post("", response_model=CustomerResponse)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    existing = db.query(Customer).filter(Customer.code == payload.code.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail="Customer code already exists")
    
    cust = Customer(
        name=payload.name.strip(),
        code=payload.code.strip().upper(),
        email=payload.email,
        phone=payload.phone,
        address=payload.address,
        country=payload.country or "Sri Lanka",
        tax_id=payload.tax_id
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)
    return cust

@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    return cust

@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(customer_id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    if payload.name is not None:
        cust.name = payload.name.strip()
    if payload.code is not None:
        cust.code = payload.code.strip().upper()
    if payload.email is not None:
        cust.email = payload.email
    if payload.phone is not None:
        cust.phone = payload.phone
    if payload.address is not None:
        cust.address = payload.address
    if payload.country is not None:
        cust.country = payload.country
    if payload.tax_id is not None:
        cust.tax_id = payload.tax_id
        
    db.commit()
    db.refresh(cust)
    return cust

@router.delete("/{customer_id}")
def delete_customer(customer_id: int, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(cust)
    db.commit()
    return {"message": "Customer deleted successfully"}
