import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.support import AuditLog


async def write_audit_log(
    db: AsyncSession,
    *,
    actor_type: str,
    actor_id: uuid.UUID | None,
    action_key: str,
    entity_type: str,
    entity_id: uuid.UUID | None = None,
    metadata: dict | None = None,
) -> AuditLog:
    """Persist an immutable audit log entry. Always call before committing the outer transaction."""
    log = AuditLog(
        id=uuid.uuid4(),
        actor_type=actor_type,
        actor_id=actor_id,
        action_key=action_key,
        entity_type=entity_type,
        entity_id=entity_id,
        metadata=metadata or {},
        created_at=datetime.now(timezone.utc),
    )
    db.add(log)
    return log
