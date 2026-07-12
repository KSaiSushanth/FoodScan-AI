import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { foodData } from "./foodData";
import "./App.css";

// Pure JS/Canvas Donut Chart Component
function DonutChart({ carbs, protein, fat }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const size = 160;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const total = carbs + protein + fat;
    if (total === 0) return;

    const carbsRatio = carbs / total;
    const proteinRatio = protein / total;
    const fatRatio = fat / total;

    let startTimestamp = null;
    const duration = 1000; // 1s animation

    const draw = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      
      // Clear canvas
      ctx.clearRect(0, 0, size, size);

      const centerX = size / 2;
      const centerY = size / 2;
      const radius = 52;
      const lineWidth = 8;

      // Draw background circle
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = lineWidth;
      ctx.stroke();

      // Ratios animated by progress
      const animatedCarbs = carbsRatio * progress;
      const animatedProtein = proteinRatio * progress;
      const animatedFat = fatRatio * progress;

      // Start angle (top of circle, -Math.PI / 2)
      let startAngle = -Math.PI / 2;

      // 1. Carbs (Sky Blue)
      if (animatedCarbs > 0) {
        const endAngle = startAngle + (animatedCarbs * 2 * Math.PI);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = "#60CFFF";
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.stroke();
        startAngle = endAngle;
      }

      // 2. Protein (Emerald Green)
      if (animatedProtein > 0) {
        const endAngle = startAngle + (animatedProtein * 2 * Math.PI);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = "#3DDB85";
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.stroke();
        startAngle = endAngle;
      }

      // 3. Fat (Rose Red)
      if (animatedFat > 0) {
        const endAngle = startAngle + (animatedFat * 2 * Math.PI);
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = "#FF6B8A";
        ctx.lineWidth = lineWidth;
        ctx.lineCap = "round";
        ctx.stroke();
      }

      if (progress < 1) {
        requestAnimationFrame(draw);
      }
    };

    requestAnimationFrame(draw);
  }, [carbs, protein, fat]);

  return <canvas ref={canvasRef} />;
}

function App() {
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [food, setFood] = useState(""); // active food key (e.g. 'pizza') or empty string for grid view
  const [confidence, setConfidence] = useState("");
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [history, setHistory] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem("foodscan_theme") || "dark");

  
  // Validation States
  const [shake, setShake] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [ripple, setRipple] = useState(null);

  // Stats CountUp Animation Values
  const [animatedMacros, setAnimatedMacros] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [healthWidth, setHealthWidth] = useState(0);

  const inputRef = useRef();

  // Load history from local storage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("food_detection_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to load history", e);
      }
    }
  }, []);

  // Save history helper
  const saveHistory = (newHistory) => {
    setHistory(newHistory);
    localStorage.setItem("food_detection_history", JSON.stringify(newHistory));
  };

  // Generate a compressed thumbnail to store in history
  const createThumbnail = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const MAX_SIZE = 80;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const processFile = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setShowTooltip(false);
  };

  const handleImageChange = (e) => processFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  };

  const handleRemoveImage = (e) => {
    e.stopPropagation();
    setImage(null);
    setPreview(null);
    setShowTooltip(false);
  };

  // CountUp animation triggering when details view loads
  const activeDish = foodData[food];
  useEffect(() => {
    if (!activeDish) return;
    
    // Animate stats numbers over 800ms (easeOutQuart)
    let startTimestamp = null;
    const duration = 800;
    const targetCal = activeDish.macros.calories;
    const targetProt = activeDish.macros.protein;
    const targetCarb = activeDish.macros.carbs;
    const targetFat = activeDish.macros.fat;

    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4); // easeOutQuart

      setAnimatedMacros({
        calories: Math.round(ease * targetCal),
        protein: Math.round(ease * targetProt * 10) / 10,
        carbs: Math.round(ease * targetCarb * 10) / 10,
        fat: Math.round(ease * targetFat * 10) / 10
      });

      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);

    // Animate health score bar width over 1s
    setHealthWidth(0);
    const healthTimer = setTimeout(() => {
      setHealthWidth(activeDish.healthScore);
    }, 50);

    return () => clearTimeout(healthTimer);
  }, [food]);

  // Ripple effect trigger helper
  const triggerRipple = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const diameter = Math.max(rect.width, rect.height);
    const radius = diameter / 2;
    const x = e.clientX - rect.left - radius;
    const y = e.clientY - rect.top - radius;
    
    setRipple({ x, y, size: diameter });
    setTimeout(() => setRipple(null), 600);
  };

  // Predict endpoint call with minimum 1.8s delay overlay
  const handlePredict = async (e) => {
    if (!image) {
      setShake(true);
      setShowTooltip(true);
      setTimeout(() => setShake(false), 400);
      setTimeout(() => setShowTooltip(false), 2000);
      return;
    }

    triggerRipple(e);
    setLoading(true);
    setAnalyzing(true);

    const animationTimerPromise = new Promise((resolve) => setTimeout(resolve, 1800));
    let response = null;
    let thumb = null;

    try {
      const formData = new FormData();
      formData.append("image", image);
      
      const [apiRes, computedThumb] = await Promise.all([
        axios.post(`${import.meta.env.VITE_API_URL || "http://127.0.0.1:5000"}/predict`, formData),
        createThumbnail(image)
      ]);
      
      response = apiRes;
      thumb = computedThumb;
    } catch (error) {
      console.error(error);
    }

    // Wait for the 1.8s animation timer to finish
    await animationTimerPromise;

    if (response && response.data) {
      const detectedFoodName = response.data.food;
      const confidenceVal = response.data.confidence;

      const foodKey = Object.keys(foodData).find(
        (key) => key.toUpperCase() === detectedFoodName.replace(" ", "_") || 
                 foodData[key].name.toUpperCase() === detectedFoodName
      ) || detectedFoodName.toLowerCase().replace(" ", "_");

      setFood(foodKey);
      setConfidence(confidenceVal);

      const matchedData = foodData[foodKey] || { name: detectedFoodName, emoji: "🍲" };
      
      const newHistoryItem = {
        id: Date.now(),
        name: matchedData.name,
        key: foodKey,
        emoji: matchedData.emoji,
        confidence: confidenceVal,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        thumbnail: thumb
      };

      saveHistory([newHistoryItem, ...history.slice(0, 9)]);
    } else {
      alert("Prediction failed. Make sure the backend Flask server is running.");
    }

    setLoading(false);
    setAnalyzing(false);
  };

  const reloadFromHistory = (item) => {
    setFood(item.key);
    setConfidence(item.confidence);
    setImage(null);
    setPreview(item.thumbnail || null);
  };

  const clearHistory = () => {
    saveHistory([]);
  };

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("foodscan_theme", nextTheme);
  };

  const activeThemeClass = `theme-${theme}`;
  const confidenceNum = parseFloat(confidence) || 98.8;

  return (
    <div className={`app-container ${activeThemeClass}`}>
      {/* LEFT SIDEBAR */}
      <aside className="sidebar">
        {/* App Header */}
        <div className="brand-header">
          <div className="brand-title-row">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3DDB85" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="logo-svg">
              <path d="M5 3v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V3" />
              <path d="M7 3v4" />
              <path d="M9 3v4" />
              <path d="M8 11v9" />
              <path d="M19 13c0-3.87-3.13-7-7-7v7h7z" />
              <path d="M12 13c0 3.87 3.13 7 7 7v-7h-7z" />
              <path d="M12 13h7" />
            </svg>
            <span className="brand-title">FoodScan <span className="brand-ai">AI</span></span>
          </div>
          <span className="brand-subtitle">Smart nutrition classifier</span>
          <div className="brand-divider"></div>
        </div>

        {/* Upload Zone */}
        <div
          className={`upload-zone ${dragging ? "dragging" : ""} ${preview ? "has-preview" : ""}`}
          onClick={() => !loading && inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); !loading && setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          {preview ? (
            <div className="upload-preview-container">
              <img src={preview} alt="Preview" className="upload-preview-img" />
              <div className="upload-preview-overlay">
                <span className="upload-preview-name">{image?.name || "Scanned Image"}</span>
              </div>
              <button className="upload-remove-btn" onClick={handleRemoveImage}>
                <i className="ti ti-x"></i>
              </button>
            </div>
          ) : (
            <div className="upload-placeholder-content">
              <i className="ti ti-upload upload-arrow-icon pulse-animation"></i>
              <p className="upload-main-text">Drop food image here</p>
              <p className="upload-sub-text">
                or <span className="upload-link-text">browse files</span>
              </p>
              <p className="upload-formats">Supports PNG, JPG, WEBP</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            disabled={loading}
            style={{ display: "none" }}
          />
        </div>

        {/* Identify Button with ripple, shake and tooltip */}
        <div className="cta-container">
          <button
            className={`identify-btn ${shake ? "shake-anim" : ""} ${loading ? "btn-loading" : ""}`}
            onClick={handlePredict}
            disabled={loading}
          >
            {ripple && (
              <span
                className="ripple-effect"
                style={{
                  left: ripple.x,
                  top: ripple.y,
                  width: ripple.size,
                  height: ripple.size
                }}
              />
            )}
            {loading ? (
              <>
                <i className="ti ti-loader-quarter spinner-icon"></i>
                <span style={{ marginLeft: "6px" }}>Analyzing...</span>
              </>
            ) : (
              "Identify Dish"
            )}
          </button>
          {showTooltip && !image && (
            <div className="validation-tooltip animate-fade-in">
              Upload an image first
            </div>
          )}
        </div>

        {/* Recent Scans */}
        <div className="sidebar-scans-section">
          <div className="scans-section-header">
            <span className="sidebar-section-label">Recent scans</span>
            {history.length > 0 && (
              <button className="clear-scans-btn" onClick={clearHistory}>
                Clear all
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <div className="scans-empty-state">
              <i className="ti ti-history empty-state-icon"></i>
              <span>No scans yet</span>
            </div>
          ) : (
            <div className="scans-list">
              {history.map((item) => (
                <div
                  key={item.id}
                  className={`scan-history-item ${food === item.key ? "active" : ""}`}
                  onClick={() => reloadFromHistory(item)}
                >
                  <div className="scan-thumb-container">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt={item.name} className="scan-thumb-img" />
                    ) : (
                      <span className="scan-thumb-emoji">{item.emoji}</span>
                    )}
                  </div>
                  <div className="scan-item-info">
                    <span className="scan-item-name">{item.name}</span>
                    <span className="scan-item-time">{item.timestamp}</span>
                  </div>
                  <div className="scan-item-badge">
                    {Math.round(item.confidence)}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle & Preset Customizer in Sidebar Bottom */}
        <div className="sidebar-footer">
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === "dark" ? (
              <>
                <i className="ti ti-sun"></i> Light Theme
              </>
            ) : (
              <>
                <i className="ti ti-moon"></i> Dark Theme
              </>
            )}
          </button>

        </div>
      </aside>

      {/* RIGHT PANEL */}
      <main className="main-panel">
        {analyzing ? (
          /* LOADING OVERLAY STATE */
          <div className="loading-state-overlay">
            <div className="loading-spinner-container">
              <i className="ti ti-loader-quarter spinner-icon loading-heavy-spinner"></i>
              <span className="loading-title">Analyzing your dish…</span>
              <span className="loading-subtitle">Detecting ingredients & calculating macros</span>
            </div>
            {/* Shimmering Skeleton Cards beneath for depth */}
            <div className="skeleton-grid-placeholder">
              <div className="skeleton-card shimmer-bg"></div>
              <div className="skeleton-card shimmer-bg"></div>
              <div className="skeleton-card shimmer-bg"></div>
            </div>
          </div>
        ) : food && activeDish ? (
          /* DISH DETAIL VIEW */
          <div className="detail-view">
            <div className="detail-navigation animate-fade-in-right">
              <button className="back-nav-btn" onClick={() => setFood("")}>
                <i className="ti ti-arrow-left"></i> Back
              </button>
            </div>

            {/* Hero Section */}
            <div className="detail-hero-section animate-fade-in-right">
              <span className="detail-emoji float-animation">{activeDish.emoji}</span>
              <div className="detail-title-info">
                <h2>{activeDish.name}</h2>
                <div className="detail-meta-row">
                  <div className="detail-confidence-badge">
                    <i className="ti ti-shield-check"></i> {confidenceNum.toFixed(1)}% Confidence
                  </div>
                </div>
              </div>
            </div>

            {/* Split Info Grid: Canvas ring chart + Macros Stat cards */}
            <div className="detail-chart-grid animate-fade-in-right">
              <div className="detail-chart-card">
                <span className="section-label">Macro Ratios</span>
                <span className="serving-size-label">{activeDish.servingSize}</span>
                <div className="canvas-wrapper">
                  <DonutChart
                    carbs={activeDish.macros.carbs}
                    protein={activeDish.macros.protein}
                    fat={activeDish.macros.fat}
                  />
                  <div className="chart-center-data">
                    <span className="chart-center-val">{activeDish.macros.calories}</span>
                    <span className="chart-center-lbl">Kcal</span>
                  </div>
                </div>
                <div className="canvas-legend">
                  <div className="legend-p">
                    <span className="legend-dot color-sky"></span>
                    <span>Carbs: {activeDish.macros.carbs}g</span>
                  </div>
                  <div className="legend-p">
                    <span className="legend-dot color-green"></span>
                    <span>Protein: {activeDish.macros.protein}g</span>
                  </div>
                  <div className="legend-p">
                    <span className="legend-dot color-rose"></span>
                    <span>Fat: {activeDish.macros.fat}g</span>
                  </div>
                </div>
              </div>

              {/* CountUp Animated Stat Cards */}
              <div className="detail-stats-card">
                <span className="section-label">Nutrition Values</span>
                <span className="serving-size-label">{activeDish.servingSize}</span>
                <div className="macros-stat-row">
                  <div className="macro-stat-card">
                    <i className="ti ti-flame macro-card-icon color-amber"></i>
                    <span className="macro-stat-val val-white">{animatedMacros.calories}</span>
                    <span className="macro-stat-name">Calories</span>
                  </div>
                  <div className="macro-stat-card">
                    <i className="ti ti-armchair-2 macro-card-icon color-green" style={{ display: "none" }}></i>
                    <i className="ti ti-barbell macro-card-icon color-green"></i>
                    <span className="macro-stat-val val-white">{animatedMacros.protein}g</span>
                    <span className="macro-stat-name">Protein</span>
                  </div>
                  <div className="macro-stat-card">
                    <i className="ti ti-cookie macro-card-icon color-sky"></i>
                    <span className="macro-stat-val val-white">{animatedMacros.carbs}g</span>
                    <span className="macro-stat-name">Carbs</span>
                  </div>
                  <div className="macro-stat-card">
                    <i className="ti ti-droplet macro-card-icon color-rose"></i>
                    <span className="macro-stat-val val-white">{animatedMacros.fat}g</span>
                    <span className="macro-stat-name">Fat</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Health Score animated filling bar */}
            <div className="detail-section animate-fade-in-right">
              <span className="section-label">Health score</span>
              <div className="health-score-container">
                <div className="health-score-track">
                  <div
                    className="health-score-fill"
                    style={{ width: `${healthWidth}%` }}
                  />
                </div>
                <span className="health-score-num">{healthWidth} / 100</span>
              </div>
            </div>

            {/* Ingredients & Steps Columns */}
            <div className="detail-split-grid animate-fade-in-right">
              {/* Ingredients with stagger scaleIn */}
              <div className="detail-section">
                <span className="section-label">Ingredients</span>
                <div className="ingredients-pills-container">
                  {activeDish.ingredients.map((ingredient, idx) => (
                    <div
                      key={idx}
                      className="ingredient-pill scale-in-animation"
                      style={{ animationDelay: `${idx * 40}ms` }}
                    >
                      {ingredient}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recipe Steps with stagger fadeUp */}
              <div className="detail-section">
                <span className="section-label">Recipe Steps</span>
                <div className="recipe-steps-list">
                  {activeDish.recipe.map((step, idx) => {
                    const firstPeriodIdx = step.indexOf(".");
                    const stepTitle = firstPeriodIdx !== -1 ? step.substring(0, firstPeriodIdx) : `Step ${idx + 1}`;
                    const stepDesc = firstPeriodIdx !== -1 ? step.substring(firstPeriodIdx + 1).trim() : step;
                    
                    return (
                      <div
                        key={idx}
                        className="recipe-step-item fade-up-animation"
                        style={{ animationDelay: `${idx * 80}ms` }}
                      >
                        <div className="recipe-step-number">{idx + 1}</div>
                        <div className="recipe-step-text-container">
                          <span className="recipe-step-title">{stepTitle}</span>
                          <p className="recipe-step-desc">{stepDesc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Healthy swap at bottom */}
            <div className="detail-section animate-fade-in-right">
              <span className="section-label">Healthy Swaps</span>
              <div className="detail-swaps-box">
                <i className="ti ti-bulb swap-idea-icon"></i>
                <p>{activeDish.healthySwaps}</p>
              </div>
            </div>
          </div>
        ) : (
          /* GRID EXPLORE STATE */
          <div className="grid-explore-view animate-fade-in-right">
            {/* Top Bar */}
            <div className="top-bar">
              <span className="top-bar-title">Explore dishes</span>
              <div className="search-input-container">
                <i className="ti ti-search search-icon"></i>
                <input
                  type="text"
                  placeholder="Search dishes…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            {/* 6-Card Dish Grid */}
            <div className="dish-cards-grid">
              {Object.keys(foodData).map((key, idx) => {
                const dish = foodData[key];
                const matchesSearch = dish.name.toLowerCase().includes(searchQuery.toLowerCase());
                
                return (
                  <div
                    key={key}
                    className={`dish-grid-card ${matchesSearch ? "card-matching" : "card-dimmed"}`}
                    style={{ "--i": idx }}
                    onClick={() => {
                      setFood(key);
                      setConfidence(98.8);
                    }}
                  >
                    <div className="dish-card-emoji-circle">
                      <span className="dish-card-emoji">{dish.emoji}</span>
                    </div>
                    <span className="dish-card-name">{dish.name}</span>
                    <p className="dish-card-desc">{dish.description}</p>
                    
                    <div className="dish-card-tags">
                      <span className="dish-tag tag-amber">
                        {dish.macros.calories} kcal
                      </span>
                      <span className="dish-tag tag-sky">
                        {dish.macros.protein}g protein
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;