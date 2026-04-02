import pandas as pd
import sys
import json

try:
    file_path = sys.argv[1]
    data = pd.read_csv(file_path)

     # DEBUG

    # Try different possible column names
    protocol_col = None
    source_col = None

    for col in data.columns:
        if "Protocol" in col:
            protocol_col = col
        if "Source" in col:
            source_col = col

    if not protocol_col or not source_col:
        raise Exception("Required columns not found")

    protocols = data[protocol_col].value_counts().to_dict()
    top_ips = data[source_col].value_counts().head(5).to_dict()

    suspicious = data[source_col].value_counts()
    alerts = suspicious[suspicious > 100].to_dict()

    result = {
        "protocols": protocols,
        "top_ips": top_ips,
        "alerts": alerts
    }

    print(json.dumps(result))

except Exception as e:
    print(json.dumps({"error": str(e)}))