import asyncio
import os
from dotenv import load_dotenv
load_dotenv("/Users/vivekchitturi/Desktop/fourback/test_agent/.env")

from pii_route import _run_pii_pipeline

async def main():
    text = "My name is John Smith and my email is john@gmail.com."
    try:
        res = await _run_pii_pipeline(text)
        print("PIPELINE RESULT:")
        print(res)
    except Exception as e:
        print("ERROR:", str(e))

asyncio.run(main())
