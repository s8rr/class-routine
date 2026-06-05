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
    
    # 1. Preserve exceptions if the JSON file already exists
    if os.path.exists(JSON_PATH):
        with open(JSON_PATH, 'r') as f:
            try:
                existing_data = json.load(f)
                if "exceptions" in existing_data:
                    data_store["exceptions"] = existing_data["exceptions"]
            except json.JSONDecodeError:
                pass
                
    # Initialize empty weekly arrays for all sections
    for sec in data_store["sections"]:
        data_store["weekly_routine"][sec] = {
            "Saturday": [], "Sunday": [], "Monday": [], "Tuesday": [], "Wednesday": []
        }

    if not os.path.exists(PDF_PATH):
        print(f"Error: {PDF_PATH} not found.")
        return

    # Regex to handle Subject/Teacher/Room
    class_pattern = re.compile(r'([A-Za-z0-9]+)\s*/\s*([A-Za-z0-9.-]+)\s*/\s*([0-9]{3,4})')

    with pdfplumber.open(PDF_PATH) as pdf:
        
        # State variables set outside the page loop so they persist across PDF page breaks
        current_day = None
        current_section = None
        time_headers = {}
        
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                if not table: continue
                
                for row_idx, row in enumerate(table):
                    if not row: continue
                    
                    row_texts = [clean_text(cell) for cell in row]
                    
                    # 2. Parse Time Headers (Updates whenever new times are detected)
                    if any(re.search(r'\d{1,2}\.\d{2}', cell) for cell in row_texts):
                        time_headers = {}
                        for col_idx, cell in enumerate(row_texts):
                            times = re.findall(r'\d{1,2}\.\d{2}', cell)
                            if len(times) >= 2:
                                time_headers[col_idx] = f"{times[0]} - {times[1]}"
                            elif len(times) == 1:
                                time_headers[col_idx] = f"{times[0]}"
                        continue

                    # 3. Unroll multiline cells to fix merged cell misalignment
                    split_row = []
                    for col_idx, cell in enumerate(row):
                        lines = [line.strip() for line in str(cell).split('\n')] if cell else []
                        
                        # First column: strip out the day text so sections align horizontally with classes
                        if col_idx == 0:
                            cleaned_lines = []
                            for line in lines:
                                is_day = False
                                for day in ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"]:
                                    if day.lower() in line.lower():
                                        current_day = day
                                        is_day = True
                                        break
                                if not is_day and line:
                                    cleaned_lines.append(line)
                            split_row.append(cleaned_lines)
                        else:
                            split_row.append([line for line in lines if line])

                    max_lines = max([len(lines) for lines in split_row] + [0])
                    
                    # 4. Process each unrolled sub-row individually
                    for line_idx in range(max_lines):
                        sub_row = []
                        for col in split_row:
                            if line_idx < len(col):
                                sub_row.append(col[line_idx])
                            else:
                                sub_row.append("")
                        
                        # Detect Section in the first few columns
                        for col_idx in [0, 1]:
                            if col_idx < len(sub_row):
                                for sec in data_store["sections"]:
                                    if sec in sub_row[col_idx]:
                                        current_section = sec
                                        break
                        
                        # 5. Extract Classes and associate with proper time map
                        if current_day and current_section:
                            for col_idx, cell_text in enumerate(sub_row):
                                matches = class_pattern.findall(cell_text)
                                if matches:
                                    time_slot = time_headers.get(col_idx, "Time TBA")
                                    for sub, teacher, room in matches:
                                        entry = {
                                            "time": time_slot,
                                            "subject": sub,
                                            "teacher": teacher,
                                            "room": room
                                        }
                                        # Append entry if it doesn't already exist (avoids redundant headers)
                                        if entry not in data_store["weekly_routine"][current_section][current_day]:
                                            data_store["weekly_routine"][current_section][current_day].append(entry)

    # 6. Save the structured JSON
    os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
    with open(JSON_PATH, 'w') as f:
        json.dump(data_store, f, indent=4)
    
    print(f"Routine extraction pipeline completed successfully. Data saved to {JSON_PATH}")

if __name__ == "__main__":
    parse_routine_pdf()
