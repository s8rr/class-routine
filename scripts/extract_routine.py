import os
import json
import re
import pdfplumber

PDF_PATH = "routine.pdf"
JSON_PATH = "data/routine_data.json"

def clean_text(text):
    if not text:
        return ""
    # Replace newlines and excessive spaces with a single space
    return re.sub(r'\s+', ' ', text).strip()

def parse_routine_pdf():
    print("Starting PDF data extraction pipeline...")
    
    # 1. Initialize Data Store
    data_store = {
        "sections": ["1A", "1B", "1C", "1D", "1E", "1F"], 
        "weekly_routine": {}, 
        "exceptions": {}
    }
    
    for sec in data_store["sections"]:
        data_store["weekly_routine"][sec] = {
            "Saturday": [], "Sunday": [], "Monday": [], "Tuesday": [], "Wednesday": []
        }

    if not os.path.exists(PDF_PATH):
        print(f"Error: {PDF_PATH} not found.")
        return

    # Updated Regex to handle alphabetic subjects, alphanumeric teacher initials, and numeric rooms
    # E.g., Matches: "IEEL/ CFK/506", "GE/Ataur/611"
    class_pattern = re.compile(r'([A-Za-z0-9]+)\s*/\s*([A-Za-z0-9.-]+)\s*/\s*([0-9]{3,4})')

    with pdfplumber.open(PDF_PATH) as pdf:
        for page in pdf.pages:
            # 2. Extract tables to maintain the grid structure
            tables = page.extract_tables()
            
            for table in tables:
                if not table:
                    continue
                    
                current_day = None
                time_headers = {}
                
                # 3. Iterate through rows in the visual grid
                for row_idx, row in enumerate(table):
                    row_texts = [clean_text(cell) for cell in row]
                    
                    # Detect Header Row (Look for times like '8.30', '9.20', '10.35')
                    if not time_headers and any(re.search(r'\d{1,2}\.\d{2}', cell) for cell in row_texts):
                        for col_idx, cell in enumerate(row_texts):
                            times = re.findall(r'\d{1,2}\.\d{2}', cell)
                            if len(times) >= 2:
                                time_headers[col_idx] = f"{times[0]} - {times[1]}"
                            elif len(times) == 1:
                                time_headers[col_idx] = f"{times[0]}"
                        continue
                    
                    # Detect Current Day (Usually in the first column)
                    first_col = row_texts[0].lower() if row_texts else ""
                    for day in ["saturday", "sunday", "monday", "tuesday", "wednesday"]:
                        if day in first_col:
                            current_day = day.capitalize()
                            break
                    
                    # Detect Current Section (Usually in column 0 or 1)
                    current_section = None
                    for sec in data_store["sections"]:
                        if sec in row_texts[0] or (len(row_texts) > 1 and sec in row_texts[1]):
                            current_section = sec
                            break
                            
                    # 4. Extract classes and match with mapped column times
                    if current_day and current_section:
                        # Iterate through every column in the current row
                        for col_idx, cell_text in enumerate(row_texts):
                            matches = class_pattern.findall(cell_text)
                            
                            if matches:
                                # Fetch the corresponding time for this column index
                                time_slot = time_headers.get(col_idx, "Time TBA")
                                
                                for sub, teacher, room in matches:
                                    entry = {
                                        "time": time_slot,
                                        "subject": sub,
                                        "teacher": teacher,
                                        "room": room
                                    }
                                    
                                    # Append if it doesn't already exist (avoids duplicates from merged cells)
                                    if entry not in data_store["weekly_routine"][current_section][current_day]:
                                        data_store["weekly_routine"][current_section][current_day].append(entry)

    # 5. Save the structured JSON
    os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
    with open(JSON_PATH, 'w') as f:
        json.dump(data_store, f, indent=4)
    
    print(f"Routine extraction pipeline completed successfully. Data saved to {JSON_PATH}")

if __name__ == "__main__":
    parse_routine_pdf()
