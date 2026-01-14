#!/usr/bin/python3

import json
import sys

if len(sys.argv) < 3:
    print(f"Usage: {sys.argv[0]} oldpath newpath", file=sys.stderr)
    sys.exit(1)

oldpath = sys.argv[1]
old_parts = oldpath.split(".")
newpath = sys.argv[2]
new_parts = newpath.split(".")

def move_path(root):
    current = root
    for p in old_parts[:-1]:
        if not isinstance(current, dict):
            raise TypeError(f"Path '{path}' traverses a non-dict value")
        current = current[p]
    try:
        value = current.pop(old_parts[1])
    except:
        raise KeyError(f"Key '{oldpath}' does not exist")

    current = root
    for p in new_parts[:-1]:
        if p not in current:
            current[p] = {}
        elif not isinstance(current[p], dict):
            raise TypeError(f"Path '{newpath}' traverses a non-dict value")
        current = current[p]
    if not new_parts[-1] in current or value:
        current[new_parts[-1]] = value

with open('tsconfig.json') as fh:
    tsconfig = json.load(fh)
print(f'Moving {oldpath} to {newpath} in tsconfig.json')
if oldpath in tsconfig['extra_strings']:
    tsconfig['extra_strings'].remove(oldpath)
    tsconfig['extra_strings'].append(newpath)
if oldpath in tsconfig['strings']:
    tsconfig['strings'].remove(oldpath)
    tsconfig['strings'].append(newpath)
with open('tsconfig.json', 'w') as fh:
    json.dump(tsconfig, fh, indent=2)


for lang in tsconfig['languages']:
    print(f'Moving {oldpath} to {newpath} in {lang}.json')
    with open(f'{lang}.json') as fh:
        data = json.load(fh)
    try:
        move_path(data['messages'])
    except:
        print(f'Failed to move {oldpath} to {newpath} in {lang}.json')
        continue
    with open(f'{lang}.json', 'w') as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)

print("Done!")
