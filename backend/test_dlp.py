import os
from dotenv import load_dotenv
load_dotenv("/Users/vivekchitturi/Desktop/fourback/test_agent/.env")
from google.cloud import dlp_v2

dlp = dlp_v2.DlpServiceClient()
project = os.environ.get("GOOGLE_CLOUD_PROJECT")
parent = f"projects/{project}/locations/global"
item = {"value": "My name is John Smith and my email is john@gmail.com"}
inspect_config = {
    "info_types": [{"name": "PERSON_NAME"}, {"name": "EMAIL_ADDRESS"}],
    "include_quote": True,
}
request = {"parent": parent, "inspect_config": inspect_config, "item": item}
response = dlp.inspect_content(request=request)
for finding in response.result.findings:
    print(f"Quote: {finding.quote}")
    print(f"Info type: {finding.info_type.name}")
    print(f"Likelihood: {finding.likelihood}")
    print(f"Start: {finding.location.codepoint_range.start}")
    print(f"End: {finding.location.codepoint_range.end}")
