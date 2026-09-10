from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

try:
    from pymongo import MongoClient
    import certifi
    _ca_file = certifi.where()
except ImportError:
    MongoClient = None
    _ca_file = None

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tariff.db")
if DATABASE_URL in ("sqlite:///./tariff.db", "sqlite:////tariff.db"):
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
    if MongoClient is None:
        return None
    if _mongo_client is None:
        try:
            kwargs = {"serverSelectionTimeoutMS": 5000}
            if _ca_file:
                kwargs["tlsCAFile"] = _ca_file
            _mongo_client = MongoClient(MONGODB_URL, **kwargs)
            _mongo_client.admin.command('ping')
            print("MongoDB Atlas Connected Successfully!")
        except Exception as e:
            print(f"MongoDB Atlas connection warning: {e}")
            _mongo_client = None
            return None
    return _mongo_client["a3_express"]

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
