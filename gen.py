#!/usr/bin/env python3

import sys
import argparse
import json

parser = argparse.ArgumentParser()
parser.add_argument("path_json")
args = parser.parse_args()


j = json.loads(open(args.path_json).read())

pages = [] # [[block]]

for block in j['blocks']:
	print(block['t'])

	if block['t'] == 'Header' and block['c'][0] == 1: # h1
		pages.append([block])
	else:
		pages[-1].append(block)

print(list(x[0] for x in pages))
