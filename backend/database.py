from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

try:
    # pyrefly: ignore [missing-import]
    from pymongo import MongoClient
    # pyrefly: ignore [missing-import]
    import certifi
    _ca_file = certifi.where()
except ImportError:
    MongoClient = None
    _ca_file = None

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

_mongo_error = None

def get_mongo_db():
    global _mongo_client, _mongo_error
    if MongoClient is None:
        _mongo_error = "MongoClient is None (pymongo import failed)"
        return None
    if _mongo_client is None:
        err_messages = []
        try:
            kwargs = {"serverSelectionTimeoutMS": 5000}
            if _ca_file and os.path.exists(_ca_file):
                kwargs["tlsCAFile"] = _ca_file
            _mongo_client = MongoClient(MONGODB_URL, **kwargs)
            _mongo_client.admin.command('ping')
            print("MongoDB Atlas Connected Successfully!")
        except Exception as e:
            err_messages.append(f"Primary error [{type(e).__name__}]: {e}")
            try:
                _mongo_client = MongoClient(
                    MONGODB_URL,
                    serverSelectionTimeoutMS=10000,
                    tlsAllowInvalidCertificates=True
                )
                _mongo_client.admin.command('ping')
                print("MongoDB Atlas Connected via Fallback Successfully!")
            except Exception as e2:
                err_messages.append(f"Fallback error [{type(e2).__name__}]: {e2}")
                _mongo_client = None
                _mongo_error = "; ".join(err_messages)
                return None
    return _mongo_client["a3_express"]

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
