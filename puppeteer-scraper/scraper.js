const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  const baseUrl = 'https://www.boulanger.com/c/ecran-pc-moniteur?numPage=';

  await page.goto(baseUrl + '1', { waitUntil: 'networkidle2' });

  // Wait for the element to be present
  await page.waitForSelector('.product-list__header-product-count', { timeout: 10000 });

  const totalArticlesText = await page.$eval('.product-list__header-product-count', el => el.textContent);
  const totalArticles = parseInt(totalArticlesText.match(/\d+/)[0], 10);
  const totalPages = Math.ceil(totalArticles / 50);

  console.log(`Total Articles: ${totalArticles}, Total Pages: ${totalPages}`);

  // Define the column headers for the CSV file
  const columnHeaders = [
    'URL', 'Product Name', 'Reference Number', 'Energy Label', 'Rating', 'Rating Count', 'Price',
    'Taille', 'Design', 'Résolution', 'Le saviez vous ?', 'Définition', 'Type de dalle', 'OLED', 'Idéal pour',
    'Format', 'Webcam intégrée', 'Angle de courbure', 'Courbure', 'Modèle', 'Temps de réponse',
    'Le saviez vous ?', 'Fréquence de balayage', "L'intêret de la fréquence de balayage", 'Luminosité',
    'Information sur la luminosité', 'Contraste', 'Angle de vue (en degré)', 'Technologie',
    'Le + de la technologie', 'HDR', 'HDMI 2.1', 'DisplayPort', 'USB-C', 'Sortie casque', 'MICRO HDMI 2.1',
    'Anti reflets', 'Filtre lumière bleue', 'Haut-parleurs intégrés', 'Découvrez nos enceintes',
    'Ecran inclinable', 'Ecran pivotable en mode portrait', 'Pied(s) ajustable(s)', 'Norme VESA',
    'Le saviez-vous ?', 'Pied ajustable', 'Le saviez vous', 'Energie label', 'Consommation en fonctionnement',
    'Consommation en fonctionnement HDR x 1000 h', 'Dimensions sans pied L x h x p',
    'Dimensions avec pied L x h x p', 'Poids avec pied', 'Poids sans pied', 'Fabriqué en', 'Garantie',
    'Disponibilité des pièces détachées (données fournisseur)', 'Référence constructeur', 'Marque'
  ];

  // Open a write stream for the CSV file with the new headers
  const writeStream = fs.createWriteStream(path.join(__dirname, 'extracted_links.csv'));
  writeStream.write(columnHeaders.join(',') + '\n');

  // Function to extract product features with default 'Unknown' for missing elements
  async function extractProductFeatures(page) {
    const features = {};
    const featureItems = document.querySelectorAll('ul[role="list"] > li.product-features__item');
    featureItems.forEach(item => {
      const label = item.querySelector('.product-features__label').innerText;
      const details = Array.from(item.querySelectorAll('.product-features__item-list__item')).map(detail => detail.innerText);
      details.forEach(detail => {
        const [key, value] = detail.split(':').map(s => s.trim());
        features[key] = value || 'Unknown';
      });
    });
    return features;
  }

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    const url = `${baseUrl}${pageNumber}`;
    console.log(`Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2' });

    const links = await page.$$eval('a.product-list__product-image-link', elements =>
      elements.map(el => el.href)
    );
    console.log(`Links on page ${pageNumber}:`, links);

    for (const link of links) {
      console.log(`Navigating to product page: ${link}`);
      await page.goto(link, { waitUntil: 'networkidle2' });

      // Extract all text inside the h1 element
      const productName = await page.$eval('h1.product__label', el => el.innerText.trim());

      // Extract reference number and remove "Réf." prefix
      const referenceNumber = await page.$eval('span.product__ref', el => el.textContent.replace('Réf.', '').trim());

      // Extract energy label, handle missing element case
      let energyLabel;
      try {
        energyLabel = await page.$eval('img.product__energy-img', el => {
          const match = el.src.match(/FLECHE-LABEL-ENERGIE-([A-G])/);
          return match ? match[1] : 'Unknown';
        });
      } catch (error) {
        console.log('Energy label image not found, setting to Unknown.');
        energyLabel = 'Unknown';
      }

      // Extract rating, handle empty rating case
      let rating;
      try {
        rating = await page.$eval('span.custom-rating__note', el => el.textContent.split(' ')[0]);
      } catch (error) {
        // Check if the rating is empty
        const isRatingEmpty = await page.$('span.custom-rating__note--empty');
        rating = isRatingEmpty ? 'No Rating' : 'Unknown';
      }

      // Extract customer rating count, handle empty case
      let ratingCount;
      try {
        ratingCount = await page.$eval('a.custom-rating__count', el => el.textContent.match(/\d+/)[0]);
      } catch (error) {
        ratingCount = '0';
      }

      // Extract and clean price, removing invisible characters
      const price = await page.$eval('p.price__amount', el => el.textContent.replace(/[^\d,]/g, '').replace(/\u202d/g, '').trim());

      // 5. Extract the "Fabriqué en" data
      console.log('Extracting fabrication country...');
      const fabricationCountry = await page.evaluate(() => {
        const fabricationElement = Array.from(document.querySelectorAll('ul[role="list"] > li.product-features__item-list__item'))
          .find(item => item.innerText.includes('Fabriqué en'));
        return fabricationElement ? fabricationElement.innerText.split(': ')[1] : null;
      });
      console.log('Extracted fabrication country:', fabricationCountry);

      // Extract product features
      const productFeatures = await page.evaluate(extractProductFeatures);

      // Prepare the data row for CSV with 'Unknown' as default for missing data
      const dataRow = [
        link, productName || 'Unknown', referenceNumber || 'Unknown', energyLabel || 'Unknown',
        rating || 'Unknown', ratingCount || 'Unknown', price || 'Unknown',
        productFeatures['Taille'] || 'Unknown', productFeatures['Design'] || 'Unknown',
        productFeatures['Résolution'] || 'Unknown', productFeatures['Le saviez vous ?'] || 'Unknown',
        productFeatures['Définition'] || 'Unknown', productFeatures['Type de dalle'] || 'Unknown',
        productFeatures['OLED'] || 'Unknown', productFeatures['Idéal pour'] || 'Unknown',
        productFeatures['Format'] || 'Unknown', productFeatures['Webcam intégrée'] || 'Unknown',
        productFeatures['Angle de courbure'] || 'Unknown', productFeatures['Courbure'] || 'Unknown',
        productFeatures['Modèle'] || 'Unknown', productFeatures['Temps de réponse'] || 'Unknown',
        productFeatures['Le saviez vous ?'] || 'Unknown', productFeatures['Fréquence de balayage'] || 'Unknown',
        productFeatures["L'intêret de la fréquence de balayage"] || 'Unknown',
        productFeatures['Luminosité'] || 'Unknown', productFeatures['Information sur la luminosité'] || 'Unknown',
        productFeatures['Contraste'] || 'Unknown', productFeatures['Angle de vue (en degré)'] || 'Unknown',
        productFeatures['Technologie'] || 'Unknown', productFeatures['Le + de la technologie'] || 'Unknown',
        productFeatures['HDR'] || 'Unknown', productFeatures['HDMI 2.1'] || 'Unknown',
        productFeatures['DisplayPort'] || 'Unknown', productFeatures['USB-C'] || 'Unknown',
        productFeatures['Sortie casque'] || 'Unknown', productFeatures['MICRO HDMI 2.1'] || 'Unknown',
        productFeatures['Anti reflets'] || 'Unknown', productFeatures['Filtre lumière bleue'] || 'Unknown',
        productFeatures['Haut-parleurs intégrés'] || 'Unknown', productFeatures['Découvrez nos enceintes'] || 'Unknown',
        productFeatures['Ecran inclinable'] || 'Unknown', productFeatures['Ecran pivotable en mode portrait'] || 'Unknown',
        productFeatures['Pied(s) ajustable(s)'] || 'Unknown', productFeatures['Norme VESA'] || 'Unknown',
        productFeatures['Le saviez-vous ?'] || 'Unknown', productFeatures['Pied ajustable'] || 'Unknown',
        productFeatures['Le saviez vous'] || 'Unknown', productFeatures['Energie label'] || 'Unknown',
        productFeatures['Consommation en fonctionnement'] || 'Unknown',
        productFeatures['Consommation en fonctionnement HDR x 1000 h'] || 'Unknown',
        productFeatures['Dimensions sans pied L x h x p'] || 'Unknown',
        productFeatures['Dimensions avec pied L x h x p'] || 'Unknown',
        productFeatures['Poids avec pied'] || 'Unknown', productFeatures['Poids sans pied'] || 'Unknown',
        productFeatures['Fabriqué en'] || 'Unknown', productFeatures['Garantie'] || 'Unknown',
        productFeatures['Disponibilité des pièces détachées (données fournisseur)'] || 'Unknown',
        productFeatures['Référence constructeur'] || 'Unknown', productFeatures['Marque'] || 'Unknown'
      ];

      // Write the data row to the CSV
      writeStream.write(dataRow.map(value => `"${value}"`).join(',') + '\n');
    }
  }

  // Close the write stream
  writeStream.end();

  await browser.close();
})();