#!/bin/bash
# HedHog Test Project Initialization Script
# This script creates a new test project and adds required libraries

# Start timer
START_TIME=$(date +%s)

# Configuration
PROJECT_NAME="test-project"
DB_TYPE="postgres"
DB_HOST="localhost"
DB_PORT="5432"
DB_USER="hedhog"
DB_PASSWORD="changeme"
DB_NAME="hedhog"
LIBRARIES=("category" "contact" "contact-us" "faq" "tag" "content")

# Install the HedHog CLI (mirrors test/init.ps1)
echo -e "\033[32mInstalling @hed-hog/cli globally...\033[0m"
npm i -g @hed-hog/cli

# Clean up existing project
echo -e "\033[33mRemoving existing project directory...\033[0m"
rm -rf "./${PROJECT_NAME}" 2>/dev/null

# Create new project
echo -e "\033[32mCreating new HedHog project...\033[0m"
hedhog new "$PROJECT_NAME" \
  --dbtype "$DB_TYPE" \
  --dbhost "$DB_HOST" \
  --dbport "$DB_PORT" \
  --dbuser "$DB_USER" \
  --dbpassword "$DB_PASSWORD" \
  --dbname "$DB_NAME" \
  --force

if [ $? -ne 0 ]; then
  echo -e "\033[31mFailed to create project\033[0m"
  exit 1
fi

# Change to project directory
cd "./${PROJECT_NAME}" || exit 1

# Add libraries
echo -e "\033[32mAdding libraries: ${LIBRARIES[*]}...\033[0m"
hedhog add "${LIBRARIES[@]}"

if [ $? -ne 0 ]; then
  echo -e "\033[31mFailed to add libraries\033[0m"
  exit 1
fi

# Calculate execution time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo -e "\n\033[36m========================================\033[0m"
echo -e "\033[32mProject initialized successfully!\033[0m"
echo -e "\033[36mTotal execution time: ${MINUTES} min ${SECONDS} sec\033[0m"
echo -e "\033[36m========================================\033[0m"
