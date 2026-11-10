from app.database import engine, Base

# Import models so SQLAlchemy knows about the tables
from app.models import Trade, PullJob


def create_tables():

    Base.metadata.create_all(bind=engine)

    print("Database tables created successfully!")

    print("Created tables:")

    print(Base.metadata.tables.keys())


if __name__ == "__main__":
    create_tables()