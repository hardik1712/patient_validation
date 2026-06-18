// All 35 image paths organized by category
const IMAGE_LIST = [
  { path: "balanced_augmented_dataset/test/Comminuted/Comminuted_13_mri_0_7810_jpeg.rf.25bdc0f6080fc0122f129e36cc19fca2_0011.jpg", category: "Comminuted" },
  { path: "balanced_augmented_dataset/test/Comminuted/Comminuted_14_mri_0_1114_jpeg.rf.686042caca2d9b59e1d22d77d5ba1c53_0016.jpg", category: "Comminuted" },
  { path: "balanced_augmented_dataset/test/Comminuted/Comminuted_14_mri_0_3560_jpeg.rf.e372b7da8056e71c04033325ac9d3a9d_0006.jpg", category: "Comminuted" },
  { path: "balanced_augmented_dataset/test/Comminuted/Comminuted_161_jpg.rf.7530f2569a447643e24f85543a51c992_0005.jpg", category: "Comminuted" },
  { path: "balanced_augmented_dataset/test/Comminuted/Comminuted_19_jpg.rf.499fe59e7b7528fdb7db7d9248de648f_0002.jpg", category: "Comminuted" },
  { path: "balanced_augmented_dataset/test/Greenstick/Greenstick_13_jpg.rf.5c601aab5d4653d2b7c40c80de3429cf_0003.jpg", category: "Greenstick" },
  { path: "balanced_augmented_dataset/test/Greenstick/Greenstick_13_mri_0_5388_jpeg.rf.d1d46273fa017058bcc9f46082f918b9_0012.jpg", category: "Greenstick" },
  { path: "balanced_augmented_dataset/test/Greenstick/Greenstick_165_jpg.rf.85137a95a445a8763a186c8f5a311a0d_0007.jpg", category: "Greenstick" },
  { path: "balanced_augmented_dataset/test/Greenstick/Greenstick_195_jpg.rf.e9496cec92ac126c6b691a0989754f6c_0001.jpg", category: "Greenstick" },
  { path: "balanced_augmented_dataset/test/Greenstick/Greenstick_34_jpg.rf.039da29095778584305f6b7d0c3b7156_0000.jpg", category: "Greenstick" },
  { path: "balanced_augmented_dataset/test/Oblique/Oblique_118_jpg.rf.003d7f30da7698ba2b8689147570afe8_0002.jpg", category: "Oblique" },
  { path: "balanced_augmented_dataset/test/Oblique/Oblique_118_jpg.rf.72929bd6691255afdb8fc24ca780cf41_0003.jpg", category: "Oblique" },
  { path: "balanced_augmented_dataset/test/Oblique/Oblique_11_jpg.rf.345c6a6acdc33a82b8f35c0c67a2c97a_0006.jpg", category: "Oblique" },
  { path: "balanced_augmented_dataset/test/Oblique/Oblique_127_jpg.rf.317404e014bd1e9eb0e8de43d9aa427a_0000.jpg", category: "Oblique" },
  { path: "balanced_augmented_dataset/test/Oblique/Oblique_127_jpg.rf.6158ee3ab5d75c90f62291de080d94ef_0007.jpg", category: "Oblique" },
  { path: "balanced_augmented_dataset/test/Oblique_Displaced/Oblique_Displaced_126_jpg.rf.0817bf53fcdec596783e0c6dcc5d7d50_0007.jpg", category: "Oblique_Displaced" },
  { path: "balanced_augmented_dataset/test/Oblique_Displaced/Oblique_Displaced_134_jpg.rf.afc3aa7bb9317657032c1dd9ad21bb58_0001.jpg", category: "Oblique_Displaced" },
  { path: "balanced_augmented_dataset/test/Oblique_Displaced/Oblique_Displaced_153_jpg.rf.377dd7ac02acd51e04cd3613b0816efe_0008.jpg", category: "Oblique_Displaced" },
  { path: "balanced_augmented_dataset/test/Oblique_Displaced/Oblique_Displaced_15_jpg.rf.5375438e888d9920b659ec4d1e6ada9c_0014.jpg", category: "Oblique_Displaced" },
  { path: "balanced_augmented_dataset/test/Oblique_Displaced/Oblique_Displaced_162_jpg.rf.ac30e1cc085a0f7de3053f1a155fde2d_0012.jpg", category: "Oblique_Displaced" },
  { path: "balanced_augmented_dataset/test/Transverse/Transverse_13_jpg.rf.3301a0994bf342b0bac5aec93ee08ead_0012.jpg", category: "Transverse" },
  { path: "balanced_augmented_dataset/test/Transverse/Transverse_153_jpg.rf.08e1a53f8b4c40907f0f20362078debc_0007.jpg", category: "Transverse" },
  { path: "balanced_augmented_dataset/test/Transverse/Transverse_153_jpg.rf.91253b9d931b8762dab5296394d4bfd7_0002.jpg", category: "Transverse" },
  { path: "balanced_augmented_dataset/test/Transverse/Transverse_15_jpg.rf.790af0f8086e2c9f31f49d4a99e32a5f_0010.jpg", category: "Transverse" },
  { path: "balanced_augmented_dataset/test/Transverse/Transverse_18_jpg.rf.5bdf9ce282f638a93067bb5348dad9cb_0015.jpg", category: "Transverse" },
  { path: "balanced_augmented_dataset/test/Transverse_Displaced/Transverse_Displaced_122_jpg.rf.0098daba0e5d1d4e575c91f2482b8649_0000.jpg", category: "Transverse_Displaced" },
  { path: "balanced_augmented_dataset/test/Transverse_Displaced/Transverse_Displaced_128_jpg.rf.61e504aaf99b9df4a19c66cdf6b1898a_0006.jpg", category: "Transverse_Displaced" },
  { path: "balanced_augmented_dataset/test/Transverse_Displaced/Transverse_Displaced_132_jpg.rf.cd34131e4299cef2bba36b8c1596c8b3_0010.jpg", category: "Transverse_Displaced" },
  { path: "balanced_augmented_dataset/test/Transverse_Displaced/Transverse_Displaced_133_jpg.rf.9d048606cd0939e5f74503f9e42f5f26_0012.jpg", category: "Transverse_Displaced" },
  { path: "balanced_augmented_dataset/test/Transverse_Displaced/Transverse_Displaced_139_jpg.rf.f6d15b51cf51fa8fda93fa4016bbb957_0001.jpg", category: "Transverse_Displaced" },
  { path: "balanced_augmented_dataset/test/Spiral/Spiral_104_jpg.rf.0d4942b7944e851c0c05303e8ade2c72_0002.jpg", category: "Spiral" },
  { path: "balanced_augmented_dataset/test/Spiral/Spiral_104_jpg.rf.44ab9e89052e49056d4e86c9aebce337_0001.jpg", category: "Spiral" },
  { path: "balanced_augmented_dataset/test/Spiral/Spiral_104_jpg.rf.ccaa67393ec31cb33304c7e64414ba57_0011.jpg", category: "Spiral" },
  { path: "balanced_augmented_dataset/test/Spiral/Spiral_113_jpg.rf.140f7373084dc6169fc5448eea08e9bd_0007.jpg", category: "Spiral" },
  { path: "balanced_augmented_dataset/test/Spiral/Spiral_141_jpg.rf.f9720705840a6ef6dda2dc1341026d64_0000.jpg", category: "Spiral" },
];

const FRACTURE_DESCRIPTIONS = {
  "Comminuted": "A comminuted fracture involves the bone being shattered into three or more fragments, often resulting from high-energy trauma.",
  "Greenstick": "A greenstick fracture is an incomplete fracture where the bone bends and partially breaks, commonly seen in children.",
  "Oblique": "An oblique fracture features a diagonal break across the bone shaft at an angle to the bone's long axis.",
  "Oblique_Displaced": "An oblique displaced fracture is a diagonal break where the bone fragments have shifted out of their normal alignment.",
  "Transverse": "A transverse fracture is a horizontal break that runs perpendicular to the long axis of the bone.",
  "Transverse_Displaced": "A transverse displaced fracture is a horizontal break where the fractured ends have moved apart from their anatomical position.",
  "Spiral": "A spiral fracture wraps around the bone in a helical pattern, typically caused by a twisting force applied to the limb."
};

const RADIOLOGIST_PROMPT = "You are a radiologist assistant. Look at this X-ray image and identify the fracture. Explain only the type and region of the fracture.";

const SOURCES = ["Gemini", "OurModel", "Llama", "MedGemma"];
const LETTERS = ["A", "B", "C", "D"];
