import json
import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from datetime import datetime

# File paths - MATCHED TO YOUR PATH
JSON_PATH = 'data/img_data.json'
OUTPUT_DIR = 'routine_images'

# The days ordered exactly from bottom to top (Index 0 to 4) matching your list
DAYS = ["Wednesday", "Tuesday", "Monday", "Sunday", "Saturday"]
DAY_INDEX_MAP = {day: idx for idx, day in enumerate(DAYS)}

# Palette mapping for uniform colors based on your layout
PALETTE = ['#4EA8DE', '#56CFE1', '#72EFDD', '#94D2BD', '#E9D8A6', '#EE9B00', '#CA6702', '#9B5DE5', '#0096C7', '#F15BB5']
subject_colors = {}

def get_color(subject):
    """Assigns a consistent color to each unique subject cleanly."""
    base_sub = subject.replace('L', '').strip().upper() # Groups Theory and Lab (e.g., IEE and IEEL)
    if base_sub not in subject_colors:
        subject_colors[base_sub] = PALETTE[len(subject_colors) % len(PALETTE)]
    return subject_colors[base_sub]

def parse_time_to_minutes(time_str):
    """Converts standard 12-hour or 24-hour time strings into minutes from 08:00."""
    time_str = time_str.strip()
    try:
        # Tries parsing 12-hour string (e.g., '08:30 AM')
        t = datetime.strptime(time_str, '%I:%M %p')
    except ValueError:
        try:
            # Tries parsing 24-hour string (e.g., '08:30' or '13:05')
            t = datetime.strptime(time_str, '%H:%M')
        except ValueError:
            return 0
    
    ref = datetime.strptime('08:00', '%H:%M')
    return int((t.hour * 60 + t.minute) - (ref.hour * 60 + ref.minute))

def generate_routine_images():
    # 1. Ensure the output folder exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 2. Load the custom JSON data configuration
    if not os.path.exists(JSON_PATH):
        print(f"❌ Error: Could not find '{JSON_PATH}'. Ensure file path is correct.")
        return
        
    with open(JSON_PATH, 'r') as f:
        data = json.load(f)
        
    sections = data.get('sections', [])
    weekly_routine = data.get('weekly_routine', {})
    
    print(f"Found {len(sections)} sections in {JSON_PATH}. Starting layout generation...")
    
    # 3. Loop dynamically through every section detected
    for section in sections:
        section_data = weekly_routine.get(section, {})
        
        fig, ax = plt.subplots(figsize=(12, 7))
        fig.patch.set_facecolor('#F8F9FA')
        ax.set_facecolor('#FFFFFF')
        
        # Grid lines tracking from 08:00 to 14:00 (every 30 mins)
        start_min = parse_time_to_minutes("08:00")
        end_min = parse_time_to_minutes("16:00")
        for mins in range(start_min, end_min + 1, 30):
            ax.axvline(mins, color='#E5E5E5', linestyle='--', linewidth=0.8, zorder=0)

        has_classes = False

        # 4. Process day layouts
        for day in DAYS:
            classes = section_data.get(day, [])
            day_idx = DAY_INDEX_MAP[day]
            
            for cls in classes:
                # Splitting standard format '08:30 AM - 10:35 AM' or '08:30-10:35'
                time_parts = cls['time'].split('-')
                if len(time_parts) != 2: 
                    continue
                
                has_classes = True
                s_min = parse_time_to_minutes(time_parts[0])
                e_min = parse_time_to_minutes(time_parts[1])
                
                # Format text matching precisely: Subject/Teacher/Room
                subject_name = cls.get('subject', 'UNKNOWN')
                teacher_name = cls.get('teacher', '')
                room_number = cls.get('room', '')
                
                label_parts = [subject_name]
                if teacher_name: label_parts.append(teacher_name)
                if room_number: label_parts.append(str(room_number))
                label_str = "/".join(label_parts)
                
                # Get exact time format cleaned for display label matching your layout
                display_start = time_parts[0].strip().split()[0]
                display_end = time_parts[1].strip().split()[0]
                
                color = get_color(subject_name)
                
                # Render Slot Rectangle
                rect = patches.Rectangle(
                    (s_min, day_idx - 0.35), e_min - s_min, 0.7, 
                    linewidth=0.5, edgecolor='#A2A2A2', facecolor=color, alpha=0.85, zorder=3
                )
                ax.add_patch(rect)
                
                # Add Text matching layout formatting
                display_text = f"{label_str}\n{display_start}-{display_end}"
                ax.text(
                    s_min + (e_min - s_min)/2, day_idx, display_text, 
                    ha='center', va='center', color='#1A1A1A', fontsize=9.5, fontweight='bold', zorder=4
                )

        if not has_classes:
            print(f"⚠️ Warning: Section {section} does not have any routine classes configured.")

        # 5. Boundaries and Ticks configuration
        ax.set_xlim(parse_time_to_minutes("08:15"), parse_time_to_minutes("13:30"))
        ax.set_ylim(-0.5, 4.5)
        
        time_ticks = ["08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00","13:30","14:00","14:30","15:00","15:30","16:00"]
        tick_positions = [parse_time_to_minutes(t) for t in time_ticks]
        ax.set_xticks(tick_positions)
        ax.set_xticklabels(time_ticks, fontsize=10.5, fontweight='semibold', color='#495057')
        
        ax.set_yticks(range(5))
        ax.set_yticklabels(DAYS, fontsize=11.5, fontweight='bold', color='#495057')

        # Title adjustments
        plt.title(f"Class Routine - Section {section} (Spring 2026 - Updated)", fontsize=16, fontweight='bold', color='#212529', pad=25)
        
        # Clear unnecessary layout borders
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#CED4DA')
        ax.spines['bottom'].set_color('#CED4DA')

        plt.tight_layout()
        
        # 6. Export high-definition asset
        save_path = os.path.join(OUTPUT_DIR, f"Section_{section}_Routine.png")
        plt.savefig(save_path, dpi=300, facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close(fig)
        print(f"✅ Generated crisp timeline for: {save_path}")

    print("🎉 Done! All images rendered perfectly.")

if __name__ == "__main__":
    generate_routine_images()
