from google.adk.agents.llm_agent import Agent
from google.genai import types
from pydantic import BaseModel
from typing import List

class PrivacyPolicyModel(BaseModel):
    hide: List[str]
    keep: List[str]
    review: List[str]

class PolicyGeneratorResponse(BaseModel):
    purpose: str
    policy: PrivacyPolicyModel

POLICY_GENERATOR_INSTRUCTION = """
You are a Privacy Policy Generator for a document anonymization tool.
Your job is to receive a "purpose" (e.g., "Resume Review", "Contract Analysis") and generate a redaction policy.

The policy must outline exactly what types of information should be hidden, kept, or reviewed manually by the user, based on the specific purpose.
"""

agent = Agent(
    name="PolicyGenerator",
    model="gemini-2.5-flash",
    instruction=POLICY_GENERATOR_INSTRUCTION,
    output_schema=PolicyGeneratorResponse,
)

root_agent = agent
