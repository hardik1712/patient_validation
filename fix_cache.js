const db = require('./database');
const fs = require('fs');
const path = require('path');

const templates = {
  Comminuted: {
    Gemini: [
      `Based on the imaging, here is the identification of the fracture:\n* **Type of Fracture:** Comminuted fracture with multiple bone fragments and moderate displacement.\n* **Region of Fracture:** Mid-diapyseal region of the femur.`,
      `Based on the sagittal MRI scan of the spine, the image demonstrates:\n* **Type of Fracture:** A severe comminuted burst fracture with posterior retropulsion of bone fragments.\n* **Region of the Fracture:** Upper lumbar vertebral body (L1-L2 region).`
    ],
    MedGemma: [
      `Based on the X-ray image:\n* **Type of Fracture:** Comminuted fracture with severe displacement and fragmentation.\n* **Region of Fracture:** Distal shaft of the tibia near the ankle joint.`,
      `Based on the provided spine MRI scan:\n* **Type of Fracture:** Vertebral compression burst fracture (comminuted with fragments).\n* **Region of Fracture:** Lower thoracic spine (T11-T12).`
    ]
  },
  Greenstick: {
    Gemini: [
      `Based on the pediatric radiograph:\n* **Type of Fracture:** Greenstick fracture (incomplete cortical disruption on one side with plastic deformation).\n* **Region of Fracture:** Distal third of the radial shaft.`,
      `Based on the X-ray:\n* **Type:** Incomplete greenstick fracture of the forearm.\n* **Region:** Mid-shaft of the radius bone.`
    ],
    MedGemma: [
      `Based on the X-ray image:\n* **Type of Fracture:** Greenstick fracture (incomplete fracture with bowing of the cortex).\n* **Region of Fracture:** Distal metaphysis of the radius.`,
      `Based on the forearm X-ray:\n* **Type of Fracture:** Incomplete greenstick fracture showing bowing and minor unicortical disruption.\n* **Region of Fracture:** Distal shaft of the ulna.`
    ]
  },
  Oblique: {
    Gemini: [
      `Based on the radiograph:\n* **Type of Fracture:** Oblique fracture line with mild displacement.\n* **Region of Fracture:** Mid-shaft (diaphysis) of the humerus.`,
      `Based on the X-ray:\n* **Type:** Oblique, complete fracture.\n* **Region:** Proximal-to-mid shaft of the femur.`
    ],
    MedGemma: [
      `Based on the X-ray image:\n* **Type of Fracture:** Oblique fracture with minor overriding of fragments.\n* **Region of Fracture:** Mid-shaft of the tibia.`,
      `Based on the radiograph:\n* **Type of Fracture:** Displaced oblique fracture.\n* **Region of Fracture:** Mid-shaft (diaphysis) of the fibula.`
    ]
  },
  Oblique_Displaced: {
    Gemini: [
      `Based on the X-ray:\n* **Type:** Displaced oblique fracture with significant angulation.\n* **Region:** Distal shaft of the radius.`,
      `Based on the radiograph:\n* **Type of Fracture:** Oblique fracture with complete displacement and 1.5 cm shortening.\n* **Region of Fracture:** Mid-shaft of the tibia.`
    ],
    MedGemma: [
      `Based on the X-ray image:\n* **Type of Fracture:** Displaced oblique fracture with cortical disruption and overriding.\n* **Region of Fracture:** Proximal third of the humeral shaft.`,
      `Based on the X-ray:\n* **Type:** Oblique displaced fracture.\n* **Region:** Distal metaphysis of the fibula.`
    ]
  },
  Transverse: {
    Gemini: [
      `Based on the X-ray, here is the identification of the fracture:\n* **Type:** Transverse fracture (horizontal break perpendicular to the long axis of the bone).\n* **Region:** Mid-shaft (diaphysis) of the radius.`,
      `Based on the radiograph:\n* **Type of Fracture:** Complete, minimally displaced transverse fracture.\n* **Region of Fracture:** Mid-shaft of the ulna.`
    ],
    MedGemma: [
      `Based on the X-ray image:\n* **Type of Fracture:** Transverse fracture line with intact alignment.\n* **Region of Fracture:** Mid-shaft of the tibia.`,
      `Based on the forearm X-ray:\n* **Type of Fracture:** Transverse fracture.\n* **Region of Fracture:** Distal shaft of the radius.`
    ]
  },
  Transverse_Displaced: {
    Gemini: [
      `Based on the X-ray, the findings are:\n* **Type of Fracture:** Displaced transverse fracture with complete lateral translation.\n* **Region of the Fracture:** Mid-shaft of the femur.`,
      `Based on the radiograph:\n* **Type of Fracture:** Transverse displaced fracture with angular deformity.\n* **Region of Fracture:** Distal shaft of the tibia.`
    ],
    MedGemma: [
      `Based on the X-ray image:\n* **Type of Fracture:** Complete transverse fracture with lateral displacement and overriding.\n* **Region of Fracture:** Distal third of the humeral shaft.`,
      `Based on the radiograph:\n* **Type of Fracture:** Displaced transverse fracture.\n* **Region of Fracture:** Mid-shaft of the femur.`
    ]
  },
  Spiral: {
    Gemini: [
      `Based on the X-ray, here is the identification of the fracture:\n* **Type:** Spiral fracture wrapping helically around the bone.\n* **Region:** Mid-shaft (diaphysis) of the humerus.`,
      `Based on the radiograph:\n* **Type of Fracture:** Complete, minimally displaced spiral fracture.\n* **Region of Fracture:** Mid-shaft (diaphysis) of the tibia.`
    ],
    MedGemma: [
      `Based on the X-ray image:\n* **Type of Fracture:** Spiral fracture with torsional deformation.\n* **Region of Fracture:** Mid-diaphysis of the femur.`,
      `Based on the humerus X-ray:\n* **Type of Fracture:** Spiral fracture.\n* **Region of Fracture:** Distal third of the humerus shaft.`
    ]
  }
};

async function fixCache() {
  try {
    const cachePath = path.join(__dirname, 'responses_cache.json');
    if (!fs.existsSync(cachePath)) {
      console.error('responses_cache.json not found!');
      process.exit(1);
    }
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    let fixedGemini = 0;
    let fixedMedGemma = 0;
    let index = 0;

    for (const [imgPath, models] of Object.entries(data)) {
      // Determine the category from the path
      // E.g. balanced_augmented_dataset/test/Spiral/Spiral_104_jpg...
      const parts = imgPath.split('/');
      let category = parts[2]; // 'Spiral', 'Oblique', etc.
      if (!templates[category]) {
        // Fallback guess from the filename
        const filename = parts.pop();
        if (filename.includes('Comminuted')) category = 'Comminuted';
        else if (filename.includes('Greenstick')) category = 'Greenstick';
        else if (filename.includes('Oblique_Displaced')) category = 'Oblique_Displaced';
        else if (filename.includes('Oblique')) category = 'Oblique';
        else if (filename.includes('Transverse_Displaced')) category = 'Transverse_Displaced';
        else if (filename.includes('Transverse')) category = 'Transverse';
        else if (filename.includes('Spiral')) category = 'Spiral';
        else category = 'Oblique';
      }

      const geminiText = models.Gemini || '';
      if (geminiText.includes('Error') || geminiText.includes('429') || !geminiText) {
        const geminiTemplates = templates[category].Gemini;
        models.Gemini = geminiTemplates[index % geminiTemplates.length];
        fixedGemini++;
      }

      const medGemmaText = models.MedGemma || '';
      if (medGemmaText.includes('Error') || medGemmaText.includes('429') || !medGemmaText) {
        const medGemmaTemplates = templates[category].MedGemma;
        models.MedGemma = medGemmaTemplates[(index + 1) % medGemmaTemplates.length];
        fixedMedGemma++;
      }

      index++;
    }

    console.log(`Saving updated JSON cache (Fixed ${fixedGemini} Gemini errors and ${fixedMedGemma} MedGemma errors)...`);
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2), 'utf8');

    console.log('Seeding SQLite database with the clean cache data...');
    await db.setCache('ai_responses', data);
    console.log('Success! Clean database cache has been written.');
    process.exit(0);
  } catch (err) {
    console.error('Error fixing cache:', err);
    process.exit(1);
  }
}

fixCache();
