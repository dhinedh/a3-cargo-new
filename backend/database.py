from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv

# pyrefly: ignore [missing-import]
from pymongo import MongoClient
# pyrefly: ignore [missing-import]
import certifi

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tariff.db")
if "sqlite" in DATABASE_URL and ("tariff.db" in DATABASE_URL or DATABASE_URL.endswith(".db")):
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tariff.db").replace("\\", "/")
    DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# MongoDB Atlas Integration
MONGODB_URL = os.getenv(
    "MONGODB_URL",
    "mongodb+srv://thenna44ck_db_user:2dWQ2jrV762IvKs6@cluster0.phdzsgq.mongodb.net/a3_express?retryWrites=true&w=majority&appName=Cluster0"
)

_mongo_client = None

def get_mongo_db():
    global _mongo_client
    if _mongo_client is None:
        try:
            ca_file = certifi.where()
            kwargs = {"serverSelectionTimeoutMS": 5000}
            if ca_file and os.path.exists(ca_file):
                kwargs["tlsCAFile"] = ca_file
            client = MongoClient(MONGODB_URL, **kwargs)
            client.admin.command('ping')
            _mongo_client = client
            print("MongoDB Atlas Connected Successfully!")
        except Exception as e:
            print(f"Primary MongoDB connection notice: {e}. Attempting fallback...")
            try:
                client = MongoClient(
                    MONGODB_URL,
                    serverSelectionTimeoutMS=10000,
                    tlsAllowInvalidCertificates=True
                )
                client.admin.command('ping')
                _mongo_client = client
                print("MongoDB Atlas Connected via Fallback Successfully!")
            except Exception as e2:
                print(f"MongoDB Atlas connection failed: {e2}")
                return None
    return _mongo_client["a3_express"]

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
