with open("src/index.css", "r") as f:
    lines = f.readlines()

new_lines = []
skip = False
for line in lines:
    if '[data-color-scheme="light"] [class*="bg-[#"' in line:
        skip = True
    if skip and '}' in line and not new_lines:
        pass # Wait, this is tricky
