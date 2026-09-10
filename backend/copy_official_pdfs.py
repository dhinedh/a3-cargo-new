import os
import shutil

source_dir = r"d:\ZECH SOFT\projects\a3 express software\Import Tariff Guide 16.05.2026"
target_dir = r"d:\ZECH SOFT\projects\a3 express software\tariff_pdfs"

os.makedirs(target_dir, exist_ok=True)

copied_count = 0
for root, dirs, files in os.walk(source_dir):
    for f in files:
        if f.lower().endswith(".pdf"):
            src_file = os.path.join(root, f)
            dst_file = os.path.join(target_dir, f)
            shutil.copy2(src_file, dst_file)
            copied_count += 1

print(f"Successfully copied {copied_count} official Sri Lanka Customs PDF files to /tariff_pdfs!")
