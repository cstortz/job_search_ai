# SQLAlchemy Requirements and Setup Guide

This document defines the requirements and best practices for using SQLAlchemy with the Job Search AI database schema.

---

## Table of Contents

1. [Dependencies](#dependencies)
2. [Database Configuration](#database-configuration)
3. [Schema Specification](#schema-specification)
4. [Type Mappings](#type-mappings)
5. [Model Examples](#model-examples)
6. [Relationships](#relationships)
7. [Best Practices](#best-practices)
8. [Common Patterns](#common-patterns)
9. [Migration Considerations](#migration-considerations)

---

## Dependencies

### Required Packages

```bash
pip install sqlalchemy
pip install psycopg2-binary  # PostgreSQL adapter
pip install pgvector  # For vector column support
```

### Optional Packages

```bash
pip install alembic  # For database migrations
pip install sqlalchemy-utils  # Additional utilities
```

### requirements.txt

```txt
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.0
pgvector>=0.2.0
alembic>=1.12.0
```

---

## Database Configuration

### Connection String Format

```python
# Development
DATABASE_URL = "postgresql://user:password@localhost:5432/job_search_ai_dev"

# Production
DATABASE_URL = "postgresql://user:password@localhost:5432/job_search_ai_prod"
```

### Engine Configuration

```python
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine

def create_db_engine(database_url: str, echo: bool = False) -> Engine:
    """
    Create SQLAlchemy engine with optimal settings for PostgreSQL.
    
    Args:
        database_url: PostgreSQL connection string
        echo: If True, log all SQL statements (useful for debugging)
    
    Returns:
        Configured SQLAlchemy engine
    """
    engine = create_engine(
        database_url,
        echo=echo,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,  # Verify connections before using
        pool_recycle=3600,   # Recycle connections after 1 hour
        connect_args={
            "options": "-csearch_path=job_search_ai"  # Set search path (no public schema)
        }
    )
    return engine
```

---

## Schema Specification

### Important: No Public Schema

**This database does not use the `public` schema** - it has been removed for security and organizational reasons to prevent developers from dumping objects into a default schema. All extensions (`uuid-ossp`, `vector`) are installed in the `job_search_ai` schema.

### Critical: Schema Name

**All tables are in the `job_search_ai` schema.** You **must** specify this in every model:

```python
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    __table_args__ = {'schema': 'job_search_ai'}  # REQUIRED!
    
    # ... columns
```

### Schema Search Path (Alternative)

You can also set the schema search path at the engine level:

```python
from sqlalchemy import event
from sqlalchemy.engine import Engine

@event.listens_for(Engine, "connect")
def set_search_path(dbapi_conn, connection_record):
    """Set schema search path on connection."""
    cursor = dbapi_conn.cursor()
    cursor.execute("SET search_path TO job_search_ai")
    cursor.close()
```

**Note:** This database does not have a `public` schema, so only `job_search_ai` should be in the search path.

**However, explicitly specifying `schema` in `__table_args__` is recommended** for clarity and to avoid issues.

---

## Type Mappings

### PostgreSQL to SQLAlchemy Type Mapping

| PostgreSQL Type | SQLAlchemy Import | Usage |
|----------------|-------------------|-------|
| `UUID` | `from sqlalchemy.dialects.postgresql import UUID` | Primary keys, foreign keys |
| `JSONB` | `from sqlalchemy.dialects.postgresql import JSONB` | JSON columns |
| `TEXT` | `from sqlalchemy import Text` | Long text fields |
| `VARCHAR(n)` | `from sqlalchemy import String` | String fields with length |
| `TIMESTAMP WITH TIME ZONE` | `from sqlalchemy import DateTime` | Timestamp fields |
| `BOOLEAN` | `from sqlalchemy import Boolean` | Boolean fields |
| `INTEGER` | `from sqlalchemy import Integer` | Integer fields |
| `DECIMAL(p, s)` | `from sqlalchemy import Numeric` | Decimal/money fields |
| `DATE` | `from sqlalchemy import Date` | Date fields |
| `vector(n)` | `from pgvector.sqlalchemy import Vector` | Vector embeddings |

### UUID Configuration

```python
from sqlalchemy.dialects.postgresql import UUID
import uuid

# Option 1: Python-side UUID generation (recommended)
id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

# Option 2: Database-side UUID generation
id = Column(UUID(as_uuid=False), primary_key=True, 
            server_default=text("uuid_generate_v4()"))
```

**Recommendation:** Use Option 1 (`as_uuid=True`) for better Python integration.

### JSONB Configuration

```python
from sqlalchemy.dialects.postgresql import JSONB

# Simple JSONB column
other_urls = Column(JSONB)

# JSONB with default value
notification_preferences = Column(
    JSONB,
    server_default='{"email": true, "sms": false, "push": true, "in_app": true}'
)
```

### Vector Column Configuration

```python
from pgvector.sqlalchemy import Vector

# Vector column with dimension (must match database dimension)
embedding = Column(Vector(1536))  # Default dimension for OpenAI embeddings
```

**Important:** The dimension (1536) must match the dimension specified in the database schema.

---

## Model Examples

### Complete User Model Example

```python
from sqlalchemy import Column, String, Text, DateTime, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = 'users'
    __table_args__ = {'schema': 'job_search_ai'}
    
    # Primary key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Required fields
    auth0_subject_id = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    
    # Optional fields
    phone = Column(String(50))
    address = Column(Text)
    email_verified = Column(Boolean, default=False)
    linkedin_url = Column(String(500))
    
    # JSONB fields
    other_urls = Column(JSONB)
    education = Column(JSONB)
    notification_preferences = Column(
        JSONB,
        server_default='{"email": true, "sms": false, "push": true, "in_app": true}'
    )
    
    # Timestamps
    timezone = Column(String(100), server_default='UTC')
    last_login_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships (defined separately)
    # jobs = relationship("Job", back_populates="user")
    # resume_packages = relationship("ResumePackage", back_populates="user")
```

### Skill Embedding Model (with Vector)

```python
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from pgvector.sqlalchemy import Vector
from sqlalchemy.orm import relationship
import uuid

class SkillEmbedding(Base):
    __tablename__ = 'skill_embeddings'
    __table_args__ = {'schema': 'job_search_ai'}
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('job_search_ai.users.id', ondelete='CASCADE'), nullable=False, index=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey('job_search_ai.roles.id', ondelete='CASCADE'), nullable=False, index=True)
    skill_id = Column(UUID(as_uuid=True), ForeignKey('job_search_ai.skills.id', ondelete='CASCADE'), nullable=False, index=True)
    
    chunk_text = Column(Text, nullable=False)
    embedding = Column(Vector(1536))  # Must match database dimension
    embedding_model_version = Column(String(255))
    embedding_dimension = Column(Integer, server_default='1536')
    index_type = Column(String(50))
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="skill_embeddings")
    role = relationship("Role", back_populates="skill_embeddings")
    skill = relationship("Skill", back_populates="skill_embeddings")
```

### Resume Package Model (Complex Example)

```python
from sqlalchemy import Column, String, Text, Integer, BigInteger, DateTime, Date, ForeignKey, Numeric, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

class ResumePackage(Base):
    __tablename__ = 'resume_packages'
    __table_args__ = (
        {'schema': 'job_search_ai'},
        CheckConstraint('version_number > 0', name='check_version_positive')
    )
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('job_search_ai.users.id', ondelete='CASCADE'), nullable=False, index=True)
    job_id = Column(UUID(as_uuid=True), ForeignKey('job_search_ai.jobs.id', ondelete='CASCADE'), nullable=False, index=True)
    
    # Status fields
    status = Column(String(50), server_default='draft', index=True)
    application_status = Column(String(50), index=True)
    
    # Dates
    date_applied = Column(DateTime(timezone=True))
    date_of_last_status_change = Column(DateTime(timezone=True))
    
    # Application method
    application_method = Column(String(50))
    application_tracking_number = Column(String(255))
    portal_url = Column(String(1000))
    application_confirmation_number = Column(String(255))
    
    # Versioning
    version_number = Column(Integer, server_default='1')
    parent_resume_package_id = Column(
        UUID(as_uuid=True),
        ForeignKey('job_search_ai.resume_packages.id', ondelete='SET NULL'),
        index=True
    )
    
    # Resume file info
    resume_file_url = Column(String(1000))
    resume_file_path = Column(String(1000))
    resume_storage_type = Column(String(50))
    resume_file_size = Column(BigInteger)
    resume_file_format = Column(String(50))
    
    # Cover letter file info
    cover_letter_file_url = Column(String(1000))
    cover_letter_file_path = Column(String(1000))
    cover_letter_storage_type = Column(String(50))
    cover_letter_file_size = Column(BigInteger)
    cover_letter_file_format = Column(String(50))
    
    # Content
    skills_used = Column(JSONB)  # Array of skill IDs
    executive_statement = Column(Text)
    technical_proficiencies = Column(Text)
    resume_maker_json = Column(JSONB)
    cover_letter_maker_json = Column(JSONB)
    resume_maker_template_version = Column(String(255))
    application_notes = Column(Text)
    application_form_data = Column(JSONB)
    
    # Rejection/withdrawal
    rejection_reason = Column(Text)
    rejection_feedback = Column(Text)
    withdrawal_reason = Column(Text)
    archive_date = Column(DateTime(timezone=True))
    
    # Timestamps
    generated_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="resume_packages")
    job = relationship("Job", back_populates="resume_packages")
    parent_package = relationship("ResumePackage", remote_side=[id], backref="child_packages")
```

---

## Relationships

### One-to-Many Relationships

```python
from sqlalchemy.orm import relationship

class User(Base):
    __tablename__ = 'users'
    __table_args__ = {'schema': 'job_search_ai'}
    
    # ... columns
    
    # One user has many jobs
    jobs = relationship("Job", back_populates="user", cascade="all, delete-orphan")
    
    # One user has many resume packages
    resume_packages = relationship("ResumePackage", back_populates="user", cascade="all, delete-orphan")
    
    # One user has many skills
    skills = relationship("Skill", back_populates="user", cascade="all, delete-orphan")

class Job(Base):
    __tablename__ = 'jobs'
    __table_args__ = {'schema': 'job_search_ai'}
    
    user_id = Column(UUID(as_uuid=True), ForeignKey('job_search_ai.users.id', ondelete='CASCADE'), nullable=False)
    
    # Many jobs belong to one user
    user = relationship("User", back_populates="jobs")
```

### Many-to-Many Relationships

For skills used in resume packages (stored as JSONB array of IDs):

```python
# Option 1: Use JSONB array (current schema design)
class ResumePackage(Base):
    skills_used = Column(JSONB)  # Array of skill UUIDs
    
    # Access skills via property
    @property
    def skills(self):
        if not self.skills_used:
            return []
        return session.query(Skill).filter(Skill.id.in_(self.skills_used)).all()

# Option 2: Create association table (if you want SQLAlchemy relationships)
resume_package_skills = Table(
    'resume_package_skills',
    Base.metadata,
    Column('resume_package_id', UUID(as_uuid=True), ForeignKey('job_search_ai.resume_packages.id', ondelete='CASCADE')),
    Column('skill_id', UUID(as_uuid=True), ForeignKey('job_search_ai.skills.id', ondelete='CASCADE')),
    schema='job_search_ai'
)

class ResumePackage(Base):
    skills = relationship("Skill", secondary=resume_package_skills, back_populates="resume_packages")
```

### Self-Referential Relationships

For resume package versioning:

```python
class ResumePackage(Base):
    parent_resume_package_id = Column(
        UUID(as_uuid=True),
        ForeignKey('job_search_ai.resume_packages.id', ondelete='SET NULL')
    )
    
    # Self-referential relationship
    parent_package = relationship("ResumePackage", remote_side=[id], backref="child_packages")
```

---

## Best Practices

### 1. Always Specify Schema

```python
# ✅ Good
class User(Base):
    __tablename__ = 'users'
    __table_args__ = {'schema': 'job_search_ai'}

# ❌ Bad - will look in 'public' schema
class User(Base):
    __tablename__ = 'users'
```

### 2. Use UUID with as_uuid=True

```python
# ✅ Good - returns Python uuid.UUID objects
id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

# ⚠️ Acceptable but less Pythonic
id = Column(UUID(as_uuid=False), primary_key=True, server_default=text("uuid_generate_v4()"))
```

### 3. Use server_default for Database Defaults

```python
# ✅ Good - database handles default
created_at = Column(DateTime(timezone=True), server_default=func.now())

# ⚠️ Less ideal - Python handles default (may not match database time)
created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
```

### 4. Handle Updated_at Consistently

The database has triggers that automatically update `updated_at`. You can:

**Option A: Let triggers handle it (recommended)**
```python
updated_at = Column(DateTime(timezone=True), server_default=func.now())
# Trigger will update it automatically
```

**Option B: Also handle in SQLAlchemy**
```python
from sqlalchemy import event

@event.listens_for(User, 'before_update', propagate=True)
def receive_before_update(mapper, connection, target):
    target.updated_at = datetime.utcnow()
```

Both approaches work together - the trigger ensures `updated_at` is always set even if SQLAlchemy doesn't update it.

### 5. Use Indexes for Foreign Keys

Foreign keys are automatically indexed in PostgreSQL, but you can also specify them explicitly:

```python
user_id = Column(UUID(as_uuid=True), ForeignKey('job_search_ai.users.id'), nullable=False, index=True)
```

### 6. Use Relationships Instead of Manual Joins

```python
# ✅ Good - use relationships
user = session.query(User).first()
jobs = user.jobs  # Automatic join

# ⚠️ Less ideal - manual join
jobs = session.query(Job).filter(Job.user_id == user.id).all()
```

---

## Common Patterns

### Session Management

```python
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@contextmanager
def get_db():
    """Context manager for database sessions."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

# Usage
with get_db() as db:
    user = db.query(User).filter(User.email == "user@example.com").first()
```

### Query Patterns

```python
# Get user by Auth0 subject ID
user = session.query(User).filter(User.auth0_subject_id == auth0_subject_id).first()

# Get all jobs for a user
jobs = session.query(Job).filter(Job.user_id == user.id).all()

# Get jobs with status
active_jobs = session.query(Job).filter(
    Job.user_id == user.id,
    Job.status == 'active'
).all()

# JSONB queries
users_with_email_notifications = session.query(User).filter(
    User.notification_preferences['email'].astext == 'true'
).all()

# Vector similarity search (pgvector)
from pgvector.sqlalchemy import Vector
similar_skills = session.query(SkillEmbedding).order_by(
    SkillEmbedding.embedding.cosine_distance(query_vector)
).limit(10).all()
```

### Bulk Operations

```python
# Bulk insert
users = [
    User(name="User 1", email="user1@example.com", auth0_subject_id="auth0|1"),
    User(name="User 2", email="user2@example.com", auth0_subject_id="auth0|2"),
]
session.bulk_save_objects(users)
session.commit()

# Bulk update
session.query(Job).filter(Job.status == 'active').update(
    {'status': 'archived'},
    synchronize_session=False
)
session.commit()
```

---

## Migration Considerations

### Using Alembic

If using Alembic for migrations:

1. **Initialize Alembic:**
```bash
alembic init alembic
```

2. **Configure alembic.ini:**
```ini
sqlalchemy.url = postgresql://user:password@localhost/job_search_ai_dev
```

3. **Update env.py to include schema:**
```python
from alembic import context
from sqlalchemy import engine_from_config, pool

# Set schema in target_metadata
target_metadata.schema = 'job_search_ai'
```

4. **Create initial migration:**
```bash
alembic revision --autogenerate -m "Initial migration"
```

**Note:** Since the schema is already created by `database_setup.sql`, you may want to mark it as already applied:

```bash
alembic stamp head
```

### Schema Changes

When modifying the schema:

1. Update `database_setup.sql`
2. Create Alembic migration: `alembic revision --autogenerate -m "Description"`
3. Review and test migration
4. Apply: `alembic upgrade head`

---

## Troubleshooting

### Common Issues

1. **"relation does not exist"**
   - **Cause:** Schema not specified in `__table_args__`
   - **Fix:** Add `__table_args__ = {'schema': 'job_search_ai'}`

2. **"pgvector extension not found"**
   - **Cause:** pgvector extension not installed in database
   - **Fix:** Run `CREATE EXTENSION IF NOT EXISTS "vector";` in database

3. **"UUID type not recognized"**
   - **Cause:** Wrong import
   - **Fix:** Use `from sqlalchemy.dialects.postgresql import UUID`

4. **"Vector dimension mismatch"**
   - **Cause:** Vector dimension in model doesn't match database
   - **Fix:** Ensure `Vector(1536)` matches database schema

5. **"updated_at not updating"**
   - **Cause:** Trigger not firing or SQLAlchemy overriding
   - **Fix:** Check triggers exist, or handle in SQLAlchemy event listener

---

## Summary Checklist

- [ ] Install required packages: `sqlalchemy`, `psycopg2-binary`, `pgvector`
- [ ] Specify schema in all models: `__table_args__ = {'schema': 'job_search_ai'}`
- [ ] Use `UUID(as_uuid=True)` for UUID columns
- [ ] Use `JSONB` from `sqlalchemy.dialects.postgresql` for JSONB columns
- [ ] Use `Vector(1536)` from `pgvector.sqlalchemy` for vector columns
- [ ] Use `server_default=func.now()` for timestamp defaults
- [ ] Define relationships for foreign keys
- [ ] Use proper cascade options in relationships
- [ ] Test connection and queries before deploying

---

## Additional Resources

- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [pgvector SQLAlchemy Documentation](https://github.com/pgvector/pgvector-python)
- [PostgreSQL JSONB Queries](https://www.postgresql.org/docs/current/datatype-json.html)
- [Alembic Documentation](https://alembic.sqlalchemy.org/)
