# ADK Agent as a FastAPI Route

Minimal example of wrapping a Google ADK agent in a FastAPI endpoint — no database, no MCP, no chat history.

---

## 1. Define the Agent

```python
# agents/my_agent/agent.py
from google.adk.agents.llm_agent import Agent

agent = Agent(
    name="MyAgent",
    model="gemini-2.5-flash",
    instruction="You are a helpful assistant.",
)

root_agent = agent
```

---

## 2. Wire the Runner

```python
# common/config/adk.py
from google.adk import Runner
from google.adk.sessions.in_memory_session_service import InMemorySessionService
from agents.my_agent.agent import root_agent

session_service = InMemorySessionService()

_runners: dict[str, Runner] = {}

def get_runner(app_name: str) -> Runner:
    if app_name not in _runners:
        _runners[app_name] = Runner(
            agent=root_agent,
            app_name=app_name,
            session_service=session_service,
        )
    return _runners[app_name]
```

> **Note:** `InMemorySessionService` keeps session state in memory — no database needed. For persistence, use `DatabaseSessionService`.

---

## 3. Create the Endpoint

```python
# router.py
from fastapi import APIRouter
from google.genai import types
from pydantic import BaseModel
from common.config.adk import get_runner

router = APIRouter()

class ChatPayload(BaseModel):
    message: str
    app_name: str = "default"

@router.post("/chat")
async def chat(payload: ChatPayload):
    runner = get_runner(payload.app_name)

    # Create a one-shot session
    session = await get_runner.session_service.create_session(
        app_name=payload.app_name,
        user_id="anonymous",
        session_id="single-turn",
    )

    new_message = types.Content(
        role="user",
        parts=[types.Part(text=payload.message)],
    )

    response_text = ""
    async for event in runner.run_async(
        user_id="anonymous",
        session_id=session.id,
        new_message=new_message,
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text

    return {"response": response_text}
```

---

## 4. Register and Run

```python
# main.py
from fastapi import FastAPI
from router import router

app = FastAPI()
app.include_router(router)
```

```bash
uvicorn main:app
```

```bash
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello!"}'
```

---

## Summary

| Piece | What it does |
|---|---|
| `Agent(name, model, instruction, tools)` | Defines the agent |
| `InMemorySessionService()` | Holds session state in memory (no DB) |
| `Runner(agent, app_name, session_service)` | Runtime that executes the agent |
| `runner.run_async(user_id, session_id, new_message)` | Streams events from the agent |
| `event.content.parts[].text` | Response text from the LLM |

That's all you need to turn an ADK agent into an HTTP endpoint.
