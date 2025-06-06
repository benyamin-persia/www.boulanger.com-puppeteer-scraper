from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import csv
import random
from fake_useragent import UserAgent
import time

def get_total_pages(driver):
    # Wait for the total number of articles element to be present
    try:
        element = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CLASS_NAME, 'product-list__header-product-count'))
        )
        text = element.text
        total_articles = int(text.split()[0].strip('()'))
        # Calculate the total number of pages
        total_pages = (total_articles // 50) + (total_articles % 50 > 0)
        return total_pages
    except Exception as e:
        print("Error: Could not find the total articles element.")
        print("Page source for debugging:")
        print(driver.page_source)  # Print the page source for debugging
        return 0

def extract_and_save_links(driver):
    # Extract href links from the specified elements
    elements = driver.find_elements(By.CSS_SELECTOR, 'a.product-list__product-image-link')
    links = []
    base_url = "https://www.boulanger.com"

    for element in elements:
        href = element.get_attribute('href')
        if href:
            full_url = base_url + href
            links.append(full_url)

    # Open the CSV file in append mode
    with open('extracted_links.csv', 'a', newline='') as csvfile:
        writer = csv.writer(csvfile)
        # Write header only if the file is empty
        if csvfile.tell() == 0:
            writer.writerow(['URL'])  # Write header
        for link in links:
            writer.writerow([link])

# Function to get a specific user agent
def get_specific_user_agent():
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'

# Verify the base URL
base_url = "https://www.boulanger.com/c/ecran-pc-moniteur?numPage="

# Use a different network or VPN if possible
# Ensure JavaScript is fully rendered

# Monitor network requests using browser developer tools

# Contact website support for scraping policies

# Use a CAPTCHA solver if necessary

# Set up the WebDriver using webdriver-manager
service = Service(ChromeDriverManager().install())
options = webdriver.ChromeOptions()
options.add_argument(f'user-agent={get_specific_user_agent()}')
# Run in headed mode
# options.add_argument('--headless')  # Commented out to run in headed mode
options.add_argument('--disable-gpu')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

# Initialize the WebDriver
driver = webdriver.Chrome(service=service, options=options)

# Use explicit waits instead of time.sleep
wait = WebDriverWait(driver, 10)  # 10 seconds timeout

# Error handling with retries
max_retries = 5  # Increase retries
retry_count = 0
total_pages = 0  # Initialize total_pages

try:
    # Define the base URL
    base_url = "https://www.boulanger.com/c/ecran-pc-moniteur?numPage="

    # Navigate to the first page to determine the total number of pages
    while retry_count < max_retries:
        try:
            driver.get(base_url + "1")
            total_pages = get_total_pages(driver)
            break
        except Exception as e:
            print(f"Error: {e}. Retrying...")
            retry_count += 1
            time.sleep(get_random_delay())

    # Iterate through the pages
    for page_number in range(1, total_pages + 1):
        url = f"{base_url}{page_number}"
        print(f"Navigating to {url}")
        retry_count = 0
        while retry_count < max_retries:
            try:
                driver.get(url)
                # Wait for the page to load by waiting for a specific element
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, 'a.product-list__product-image-link')))
                extract_and_save_links(driver)  # Extract and save links
                break
            except Exception as e:
                print(f"Error: {e}. Retrying...")
                retry_count += 1
                time.sleep(get_random_delay())
        # Random delay to mimic human behavior
        time.sleep(get_random_delay())

finally:
    # Close the browser
    driver.quit()

# Note: CAPTCHA solving and contacting website support are not implemented in this script.
# You may need to use a CAPTCHA solving service and reach out to the website for scraping policies.
