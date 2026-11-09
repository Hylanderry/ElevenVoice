"""Read and change which outside tools (MCP, OpenAI-compatible API) may connect."""
from fastapi import APIRouter
from pydantic import BaseModel

from core import agent_access

router = APIRouter(tags=["Integrations"])


class AgentAccessUpdate(BaseModel):
    mcp: bool | None = None
    openai_api: bool | None = None


@router.get("/system/agent-access")
def get_agent_access() -> dict:
    return agent_access.settings()


@router.put("/system/agent-access")
def put_agent_access(body: AgentAccessUpdate) -> dict:
    return agent_access.update({k: v for k, v in body.model_dump().items() if v is not None})
