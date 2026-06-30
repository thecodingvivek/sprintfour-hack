import asyncio

try:
    from .common.config.env import load_backend_env
except ImportError:
    from common.config.env import load_backend_env

load_backend_env()

try:
    from .pii_route import _run_pii_pipeline
except ImportError:
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
