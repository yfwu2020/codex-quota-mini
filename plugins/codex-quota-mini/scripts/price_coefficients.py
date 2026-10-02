#!/usr/bin/env python3
"""Derive motion weights from the verified price snapshot; never calls an API."""
import json
from pathlib import Path


def calculate():
    catalog = json.loads((Path(__file__).resolve().parents[1] / 'assets/api-prices.json').read_text())
    prices = catalog['models']
    def blended(price):
        return price['input'] * catalog['inputShare'] + price['output'] * catalog['outputShare']
    baseline = blended(prices[catalog['baseline']])
    return {'defaultCoefficient': 1,
            'models': {name: blended(price) / baseline for name, price in prices.items()}}


if __name__ == '__main__':
    print(json.dumps(calculate(), ensure_ascii=False))
