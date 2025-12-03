#!/usr/bin/env bash
# exit on error
set -o errexit

echo "Installing Node dependencies..."
npm install

echo "Building Frontend..."
npm run build

echo "Installing Python dependencies..."
pip install -r requirements.txt
