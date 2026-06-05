import os
import json
import re
import pdfplumber

PDF_PATH = "routine.pdf"
JSON_PATH = "data/routine_data.json"

def clean_text(text):
    if not text: return ""
    # Replace newlines and extra whitespace with a single space
    return re.sub(r'\s+', ' ', str(text)).strip()

def parse_routine_pdf():
    print("Starting PDF data extraction pipeline...")
    
    data_store = {
        "overright": False,
        "sections": ["1A", "1B", "1C", "1D", "1E", "1F"], 
        "weekly_routine": {}, 
        "exceptions": {}
    }
    
    if os.path.exists(JSON_PATH):
        try:
            with open(JSON_PATH, 'r') as f:
                existing_data = json.load(f)
                data_store["exceptions"] = existing_data.get("exceptions", {})
        except Exception as e:
            print(f"Could not load existing JSON: {e}")
                
    for sec in data_store["sections"]:
        data_store["weekly_routine"][sec] = {
            "Saturday": [], "Sunday": [], "Monday": [], "Tuesday": [], "Wednesday": []
        }

    if not os.path.exists(PDF_PATH):
        print(f"Error: {PDF_PATH} not found.")
        return

    # Broadened regex to catch slight misspellings or hyphenated room numbers
    class_pattern = re.compile(r'([A-Za-z0-9]+)\s*/\s*([A-Za-z0-9.-]+)\s*/\s*([0-9A-Za-z]{3,4})')
    
    # Standard fallback times if column indexing fails
    standard_times = [
        "08:30 AM - 09:20 AM", "09:45 AM - 10:35 AM", 
        "11:00 AM - 11:50 AM", "12:15 PM - 01:05 PM", 
        "01:30 PM - 02:20 PM", "02:45 PM - 03:35 PM"
    ]

    with pdfplumber.open(PDF_PATH) as pdf:
        current_day = None
        
        for page in pdf.pages:
            for table in page.extract_tables():
                if not table: continue
                
                time_headers = {}
                
                for row_idx, row in enumerate(table):
                    row_texts = [clean_text(cell) for cell in row]
                    if not any(row_texts): continue
                    
                    # 1. Map Time Headers
                    if any(re.search(r'\d{1,2}\.\d{2}', cell) for cell in row_texts):
                        for col_idx, cell in enumerate(row_texts):
                            times = re.findall(r'\d{1,2}\.\d{2}', cell)
                            if len(times) >= 2: 
                                time_headers[col_idx] = f"{times[0]} - {times[1]}"
                        continue

                    # 2. Track Day
                    first_cell_lower = row_texts[0].lower()
                    for day in ["saturday", "sunday", "monday", "tuesday", "wednesday"]:
                        if day in first_cell_lower:
                            current_day = day.capitalize()
                            break
                    
                    # 3. Track Section (Reset per row to avoid leakage)
                    current_section = None
                    for sec in data_store["sections"]:
                        # Check first two columns for section ID
                        if sec in row_texts[0] or (len(row_texts) > 1 and sec in row_texts[1]):
                            current_section = sec
                            break

                    # 4. Extract Classes
                    if current_day and current_section:
                        class_count = 0
                        for col_idx, cell_text in enumerate(row_texts):
                            matches = class_pattern.findall(cell_text)
                            for sub, teacher, room in matches:
                                # Fallback to standard times if column mapping breaks due to merged cells
                                assigned_time = time_headers.get(col_idx) or standard_times[min(class_count, len(standard_times)-1)]
                                
                                entry = {
                                    "time": assigned_time, 
                                    "subject": sub, 
                                    "teacher": teacher, 
                                    "room": room
                                }
                                
                                routine = data_store["weekly_routine"][current_section][current_day]
                                if entry not in routine:
                                    routine.append(entry)
                                class_count += 1

    os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
    with open(JSON_PATH, 'w') as f:
        json.dump(data_store, f, indent=2)
    
    print(f"Extraction successful. Data saved to {JSON_PATH}")

if __name__ == "__main__":
    parse_routine_pdf()
