import json
import os
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from datetime import datetime
import re

# File paths
JSON_PATH = 'data/img_data.json'
OUTPUT_DIR = 'routine_images'

# The days we want to plot (ordered from top to bottom)
DAYS = ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"]
DAY_Y_MAP = {day: i for i, day in enumerate(reversed(DAYS))}

# A nice color palette for different subjects
PALETTE = ['#4EA8DE', '#9B5DE5', '#F15BB5', '#00F5D4', '#FEE440', '#00BBF9', '#FF99C8', '#90DBF4', '#81B29A', '#E07A5F']
subject_colors = {}

def get_color(subject):
    """Assigns a consistent color to each unique subject."""
    base_sub = subject.replace('L', '') # Groups Lab and Theory together (e.g., IEE and IEEL)
    if base_sub not in subject_colors:
        subject_colors[base_sub] = PALETTE[len(subject_colors) % len(PALETTE)]
    return subject_colors[base_sub]

def parse_time_to_minutes(time_str):
    """Converts a string like '08:30 AM' into minutes since 8:00 AM"""
    try:
        t = datetime.strptime(time_str.strip(), '%I:%M %p')
        ref = datetime.strptime('08:00 AM', '%I:%M %p')
        return (t - ref).total_seconds() / 60
    except ValueError:
        return 0

def generate_routine_images():
    # 1. Ensure the output folder exists
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    # 2. Load the JSON Data
    with open(JSON_PATH, 'r') as f:
        data = json.load(f)
        
    sections = data.get('sections', [])
    weekly_routine = data.get('weekly_routine', {})
    
    print(f"Found {len(sections)} sections. Generating images...")
    
    # 3. Loop through every section
    for section in sections:
        section_data = weekly_routine.get(section, {})
        
        # Setup the canvas
        fig, ax = plt.subplots(figsize=(14, 8))
        fig.patch.set_facecolor('#F8F9FA') # Background color
        ax.set_facecolor('#FFFFFF')
        
        # Plot background grid lines (every 30 mins)
        for mins in range(0, 420, 30): # 8:00 AM to 3:00 PM (420 minutes)
            ax.axvline(mins, color='#E9ECEF', linestyle='--', linewidth=1, zorder=0)

        # 4. Loop through each day and class in the current section
        for day in DAYS:
            classes = section_data.get(day, [])
            y_pos = DAY_Y_MAP[day]
            
            for cls in classes:
                # Split "08:30 AM - 09:20 AM" into start and end
                time_parts = cls['time'].split('-')
                if len(time_parts) != 2: continue
                
                start_min = parse_time_to_minutes(time_parts[0])
                end_min = parse_time_to_minutes(time_parts[1])
                duration = end_min - start_min
                
                color = get_color(cls['subject'])
                
                # Draw the Class Box
                rect = patches.Rectangle(
                    (start_min, y_pos - 0.35), duration, 0.7, 
                    linewidth=1, edgecolor=color, facecolor=color, alpha=0.85, zorder=3
                )
                ax.add_patch(rect)
                
                # Format text to fit inside the box
                display_text = f"{cls['subject']}\n{cls['teacher']} | {cls['room']}\n{cls['time']}"
                
                # Add the Text inside the box
                ax.text(
                    start_min + (duration/2), y_pos, display_text, 
                    ha='center', va='center', color='black', fontsize=9, fontweight='bold', zorder=4
                )

        # 5. Formatting the Graph Axes
        # X-Axis (Time)
        time_ticks = ["08:30 AM", "09:20 AM", "10:35 AM", "11:50 AM", "01:05 PM", "02:20 PM"]
        tick_positions = [parse_time_to_minutes(t) for t in time_ticks]
        ax.set_xticks(tick_positions)
        ax.set_xticklabels([t.replace(" AM", "AM").replace(" PM", "PM") for t in time_ticks], fontsize=10, fontweight='bold', color='#495057')
        ax.set_xlim(parse_time_to_minutes("08:15 AM"), parse_time_to_minutes("02:30 PM"))
        
        # Y-Axis (Days)
        ax.set_yticks(range(5))
        ax.set_yticklabels(reversed(DAYS), fontsize=12, fontweight='bold', color='#495057')
        ax.set_ylim(-0.5, 4.5)

        # Title and Clean up
        plt.title(f"Class Routine - Section {section} (Spring 2026)", fontsize=20, fontweight='900', color='#212529', pad=20)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#CED4DA')
        ax.spines['bottom'].set_color('#CED4DA')

        plt.tight_layout()
        
        # 6. Save the Image
        save_path = os.path.join(OUTPUT_DIR, f"Section_{section}_Routine.png")
        plt.savefig(save_path, dpi=300, bbox_inches='tight', facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close(fig) # Close memory
        print(f"✅ Generated: {save_path}")

    print("🎉 All section images generated successfully!")

if __name__ == "__main__":
    generate_routine_images()
