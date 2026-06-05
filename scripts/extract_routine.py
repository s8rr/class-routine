import os
import json
import re
import pdfplumber

PDF_PATH = "routine.pdf"
JSON_PATH = "data/routine_data.json"

def clean_text(text):
    if not text: return ""
    return re.sub(r'\s+', ' ', str(text)).strip()

def parse_routine_pdf():
    print("Starting PDF data extraction pipeline...")
    
    data_store = {
        "sections": ["1A", "1B", "1C", "1D", "1E", "1F"], 
        "weekly_routine": {}, 
        "exceptions": {}
    }
    
    # Preserve exceptions
    if os.path.exists(JSON_PATH):
        try:
            with open(JSON_PATH, 'r') as f:
                existing_data = json.load(f)
                data_store["exceptions"] = existing_data.get("exceptions", {})
        except: pass
                
    for sec in data_store["sections"]:
        data_store["weekly_routine"][sec] = {
            "Saturday": [], "Sunday": [], "Monday": [], "Tuesday": [], "Wednesday": []
        }

    if not os.path.exists(PDF_PATH):
        print(f"Error: {PDF_PATH} not found.")
        return

    class_pattern = re.compile(r'([A-Za-z0-9]+)\s*/\s*([A-Za-z0-9.-]+)\s*/\s*([0-9]{3,4})')

    with pdfplumber.open(PDF_PATH) as pdf:
        # Context that persists across the whole document
        global_state = {"day": None, "section": None}
        
        for page in pdf.pages:
            for table in page.extract_tables():
                if not table: continue
                
                time_headers = {}
                
                for row in table:
                    row_texts = [clean_text(cell) for cell in row]
                    
                    # 1. Update Time Headers
                    if any(re.search(r'\d{1,2}\.\d{2}', cell) for cell in row_texts):
                        for col_idx, cell in enumerate(row_texts):
                            times = re.findall(r'\d{1,2}\.\d{2}', cell)
                            if times: time_headers[col_idx] = " - ".join(times)
                        continue

                    # 2. Update Day and Section Context (Persistent across rows)
                    first_cell = row_texts[0].lower()
                    for day in ["saturday", "sunday", "monday", "tuesday", "wednesday"]:
                        if day in first_cell: global_state["day"] = day.capitalize()
                    
                    for sec in data_store["sections"]:
                        if sec in row_texts[0] or (len(row_texts) > 1 and sec in row_texts[1]):
                            global_state["section"] = sec

                    # 3. Extract Classes
                    if global_state["day"] and global_state["section"]:
                        for col_idx, cell_text in enumerate(row_texts):
                            for sub, teacher, room in class_pattern.findall(cell_text):
                                entry = {"time": time_headers.get(col_idx, "TBA"), "subject": sub, "teacher": teacher, "room": room}
                                routine = data_store["weekly_routine"][global_state["section"]][global_state["day"]]
                                if entry not in routine:
                                    routine.append(entry)

    # 4. Save with absolute certainty
    os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
    with open(JSON_PATH, 'w') as f:
        json.dump(data_store, f, indent=4)
    
    print(f"Extraction successful. Data saved to {JSON_PATH}")

if __name__ == "__main__":
    parse_routine_pdf()
