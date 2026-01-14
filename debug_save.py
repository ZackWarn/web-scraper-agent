
import logging
from worker_new import save_extracted_data
import db_new

# Configure logging
logging.basicConfig(level=logging.INFO)

test_domain = "debug_save_test.com"
test_data = {
    "contact_information": {
        "text": "Head Office",
        "company_name": "Debug Save Test Corp",
        "full_address": "123 Debug Lane",
        "email": "test@debug.com"
    }
}

print(f"Attempting to save data for {test_domain}...")
try:
    save_extracted_data(test_domain, test_data)
    print("save_extracted_data returned successfully.")
except Exception as e:
    print(f"save_extracted_data failed with: {e}")

# Verify
print("Verifying in DB...")
conn = db_new.get_conn()
cursor = conn.cursor()
cursor.execute("SELECT * FROM contact_information WHERE domain=?", (test_domain,))
row = cursor.fetchone()
if row:
    print(f"SUCCESS: Found row in DB: {dict(row)}")
else:
    print("FAILURE: No row found in DB.")
conn.close()
