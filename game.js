class GameOfLife {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.cellSize = 10;
        this.cols = Math.floor(canvas.width / this.cellSize);
        this.rows = Math.floor(canvas.height / this.cellSize);
        
        // Game state
        this.grid = this.createEmptyGrid();
        this.isRunning = false;
        this.generation = 0;
        this.speed = 10; // Updates per second
        this.lastUpdate = 0;
        this.previousPopulation = 0;
        
        // Enhanced statistics
        this.history = []; // Store grid states for time travel
        this.populationHistory = [];
        this.birthHistory = [];
        this.deathHistory = [];
        this.maxPopulation = 0;
        this.stabilityCounter = 0;
        this.lastFewStates = [];
        
        // Advanced features
        this.cellAges = this.createEmptyGrid(); // Track how long cells have been alive
        this.activityMap = this.createEmptyGrid(); // Track cell activity for heat maps
        this.entropyHistory = [];
        this.isDragging = false;
        this.lastDragCell = null;
        
        // Chart canvases
        this.populationChart = null;
        this.rateChart = null;
        
        // Colors - Updated for elegant theme
        this.colors = {
            dead: '#0f0f23',
            alive: '#00d9ff',
            grid: 'rgba(255, 255, 255, 0.03)',
            hover: '#e94560'
        };
        
        this.setupEventListeners();
        this.initializeCharts();
        
        // Initialize entropy history with first calculation
        const initialEntropy = this.calculateEntropy();
        this.entropyHistory.push(initialEntropy);
        
        this.saveState(); // Save initial state
        this.render();
        this.updateStats();
        this.updateCharts(); // Make sure charts are drawn initially
        
        // Initialize sound effects
        this.soundEnabled = true;
        this.soundVolume = 0.5;
        this.initializeSounds();
        
        // Generate pattern thumbnails
        this.generatePatternThumbnails();
    }
    
    createEmptyGrid() {
        return Array(this.rows).fill().map(() => Array(this.cols).fill(0));
    }
    
    setupEventListeners() {
        // Mouse events for cell toggling and drag drawing
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => {
            this.hoverCell = null;
            this.isDragging = false;
            this.render();
        });
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            this.handleTouchStart(x, y);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            this.handleTouchMove(x, y);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            this.isDragging = false;
        });
    }
    
    handleMouseDown(e) {
        this.isDragging = true;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.paintCell(x, y, true);
    }
    
    handleMouseUp(e) {
        this.isDragging = false;
        this.lastDragCell = null;
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            this.hoverCell = { row, col };
            
            // Drag drawing
            if (this.isDragging) {
                this.paintCell(x, y, false);
            }
        } else {
            this.hoverCell = null;
        }
        this.render();
    }
    
    handleTouchStart(x, y) {
        this.isDragging = true;
        this.paintCell(x, y, true);
    }
    
    handleTouchMove(x, y) {
        if (this.isDragging) {
            this.paintCell(x, y, false);
        }
    }
    
    paintCell(x, y, isInitialClick) {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            // Avoid painting the same cell multiple times during drag
            const cellKey = `${row},${col}`;
            if (!isInitialClick && this.lastDragCell === cellKey) {
                return;
            }
            this.lastDragCell = cellKey;
            
            // Toggle cell state
            this.grid[row][col] = this.grid[row][col] ? 0 : 1;
            
            // Update cell age and activity
            if (this.grid[row][col] === 1) {
                this.cellAges[row][col] = 0; // Reset age for new cells
            } else {
                this.cellAges[row][col] = 0;
            }
            this.activityMap[row][col] = Math.min(this.activityMap[row][col] + 1, 10);
            
            // Update entropy when manually editing
            if (this.entropyHistory.length > 0) {
                const currentEntropy = this.calculateEntropy();
                this.entropyHistory[this.entropyHistory.length - 1] = currentEntropy;
            }
            
            this.render();
            this.updateStats();
            this.updateCharts();
            
            // Play cell toggle sound
            this.playSound(this.grid[row][col] ? 880 : 440, 0.05, 'square');
        }
    }
    
    toggleCell(x, y) {
        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);
        
        if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
            this.grid[row][col] = this.grid[row][col] ? 0 : 1;
            this.render();
            this.updateStats();
        }
    }
    
    countNeighbors(row, col) {
        let count = 0;
        for (let i = -1; i <= 1; i++) {
            for (let j = -1; j <= 1; j++) {
                if (i === 0 && j === 0) continue;
                
                const newRow = row + i;
                const newCol = col + j;
                
                if (newRow >= 0 && newRow < this.rows && 
                    newCol >= 0 && newCol < this.cols) {
                    count += this.grid[newRow][newCol];
                }
            }
        }
        return count;
    }
    
    nextGeneration() {
        const newGrid = this.createEmptyGrid();
        const newCellAges = this.createEmptyGrid();
        let births = 0;
        let deaths = 0;
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const neighbors = this.countNeighbors(row, col);
                const currentCell = this.grid[row][col];
                
                // Conway's Game of Life rules
                if (currentCell === 1) {
                    // Live cell with 2 or 3 neighbors survives
                    if (neighbors === 2 || neighbors === 3) {
                        newGrid[row][col] = 1;
                        newCellAges[row][col] = this.cellAges[row][col] + 1; // Age the cell
                    } else {
                        deaths++; // Cell dies
                        this.activityMap[row][col] = Math.min(this.activityMap[row][col] + 1, 10);
                    }
                } else {
                    // Dead cell with exactly 3 neighbors becomes alive
                    if (neighbors === 3) {
                        newGrid[row][col] = 1;
                        newCellAges[row][col] = 0; // New cell starts at age 0
                        births++; // Cell is born
                        this.activityMap[row][col] = Math.min(this.activityMap[row][col] + 1, 10);
                    }
                }
                
                // Decay activity map
                if (this.activityMap[row][col] > 0) {
                    this.activityMap[row][col] = Math.max(0, this.activityMap[row][col] - 0.1);
                }
            }
        }
        
        this.grid = newGrid;
        this.cellAges = newCellAges;
        this.generation++;
        
        // Calculate entropy
        const entropy = this.calculateEntropy();
        this.entropyHistory.push(entropy);
        
        // Track statistics
        this.birthHistory.push(births);
        this.deathHistory.push(deaths);
        this.saveState();
        this.updateStats();
        this.updateCharts();
        this.render();
    }
    
    saveState() {
        // Save current grid state for time travel
        const gridCopy = this.grid.map(row => [...row]);
        this.history.push(gridCopy);
        
        const population = this.countLivingCells();
        this.populationHistory.push(population);
        
        // Update max population
        if (population > this.maxPopulation) {
            this.maxPopulation = population;
        }
        
        // Check for stability (oscillators, still lifes)
        const gridString = JSON.stringify(this.grid);
        this.lastFewStates.push(gridString);
        if (this.lastFewStates.length > 10) {
            this.lastFewStates.shift();
        }
        
        // Check if current state appeared recently (indicates oscillation or stability)
        const recentOccurrence = this.lastFewStates.slice(0, -1).indexOf(gridString);
        if (recentOccurrence !== -1) {
            this.stabilityCounter++;
        } else {
            this.stabilityCounter = 0;
        }
    }
    
    goToGeneration(targetGen) {
        if (targetGen >= 0 && targetGen < this.history.length) {
            this.generation = targetGen;
            this.grid = this.history[targetGen].map(row => [...row]);
            this.render();
            this.updateStats();
            this.updateCharts(); // Update charts when traveling through time
            this.updateProgressBar();
        }
    }
    
    calculateEntropy() {
        let entropy = 0;
        const totalCells = this.rows * this.cols;
        const livingCells = this.countLivingCells();
        
        if (livingCells === 0 || livingCells === totalCells) {
            return 0; // No entropy in completely ordered states
        }
        
        const p1 = livingCells / totalCells; // Probability of living cell
        const p0 = 1 - p1; // Probability of dead cell
        
        if (p1 > 0) entropy -= p1 * Math.log2(p1);
        if (p0 > 0) entropy -= p0 * Math.log2(p0);
        
        return entropy;
    }
    
    resizeGrid(newCols, newRows) {
        const oldGrid = this.grid;
        const oldCellAges = this.cellAges;
        const oldActivityMap = this.activityMap;
        
        this.cols = newCols;
        this.rows = newRows;
        this.cellSize = Math.min(
            Math.floor(this.canvas.width / this.cols),
            Math.floor(this.canvas.height / this.rows)
        );
        
        // Create new grids
        this.grid = this.createEmptyGrid();
        this.cellAges = this.createEmptyGrid();
        this.activityMap = this.createEmptyGrid();
        
        // Copy over existing cells that fit
        const copyRows = Math.min(oldGrid.length, this.rows);
        const copyCols = Math.min(oldGrid[0].length, this.cols);
        
        for (let row = 0; row < copyRows; row++) {
            for (let col = 0; col < copyCols; col++) {
                this.grid[row][col] = oldGrid[row][col];
                this.cellAges[row][col] = oldCellAges[row][col];
                this.activityMap[row][col] = oldActivityMap[row][col];
            }
        }
        
        this.render();
        this.updateStats();
    }
    
    initializeSounds() {
        // Create audio context for sound effects
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.log('Web Audio API not supported');
            this.soundEnabled = false;
        }
    }
    
    playSound(frequency, duration = 0.1, type = 'sine') {
        if (!this.soundEnabled || !this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        
        // Handle unsupported wave types
        try {
            oscillator.type = type;
        } catch (e) {
            oscillator.type = 'square'; // Fallback to square wave
        }
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.soundVolume * 0.1, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    generatePatternThumbnails() {
        const thumbnails = document.querySelectorAll('.preset-thumbnail');
        
        thumbnails.forEach(thumbnail => {
            const patternName = thumbnail.parentElement.getAttribute('data-preset');
            const pattern = patterns[patternName];
            
            if (pattern) {
                this.drawThumbnail(thumbnail, pattern);
            }
        });
    }
    
    drawThumbnail(canvas, pattern) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.fillStyle = this.colors.dead;
        ctx.fillRect(0, 0, width, height);
        
        // Calculate cell size to fit pattern
        const patternWidth = pattern[0].length;
        const patternHeight = pattern.length;
        const cellSize = Math.min(
            Math.floor(width / patternWidth),
            Math.floor(height / patternHeight),
            8 // Maximum cell size
        );
        
        // Center the pattern
        const offsetX = (width - patternWidth * cellSize) / 2;
        const offsetY = (height - patternHeight * cellSize) / 2;
        
        // Draw pattern
        ctx.fillStyle = this.colors.alive;
        for (let row = 0; row < patternHeight; row++) {
            for (let col = 0; col < patternWidth; col++) {
                if (pattern[row][col] === 1) {
                    ctx.fillRect(
                        offsetX + col * cellSize,
                        offsetY + row * cellSize,
                        cellSize - 1,
                        cellSize - 1
                    );
                }
            }
        }
    }
    
    updateColors(aliveColor, deadColor, gridColor) {
        this.colors.alive = aliveColor;
        this.colors.dead = deadColor;
        this.colors.grid = gridColor;
        
        // Update thumbnails
        this.generatePatternThumbnails();
        this.render();
        this.updateCharts();
    }
    
    getAgeColor(age) {
        // Create color gradient from cyan (young) to purple (old)
        const maxAge = 50; // Maximum age for color scaling
        const normalizedAge = Math.min(age / maxAge, 1);
        
        // Interpolate between cyan and purple
        const r = Math.floor(0 + normalizedAge * 128); // 0 to 128
        const g = Math.floor(217 - normalizedAge * 100); // 217 to 117  
        const b = Math.floor(255 - normalizedAge * 100); // 255 to 155
        
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    initializeCharts() {
        this.populationChart = document.getElementById('populationChart');
        this.rateChart = document.getElementById('rateChart');
        this.entropyChart = document.getElementById('entropyChart');
        
        // Set proper canvas sizing
        this.resizeCharts();
    }
    
    resizeCharts() {
        const containers = document.querySelectorAll('.chart-container');
        containers.forEach(container => {
            const canvas = container.querySelector('canvas');
            if (canvas) {
                const rect = container.getBoundingClientRect();
                const dpr = window.devicePixelRatio || 1;
                
                // Set display size
                canvas.style.width = rect.width + 'px';
                canvas.style.height = rect.height + 'px';
                
                // Set actual size in memory (scaled for retina displays)
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                
                // Scale the drawing context so everything draws at the correct size
                const ctx = canvas.getContext('2d');
                ctx.scale(dpr, dpr);
            }
        });
    }
    
    updateCharts() {
        this.drawPopulationChart();
        this.drawRateChart();
        this.drawEntropyChart();
        this.updateProgressBar();
    }
    
    drawPopulationChart() {
        const canvas = this.populationChart;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Clear canvas
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, width, height);
        
        if (this.populationHistory.length < 2) return;
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = (height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        // Draw population line
        const maxPop = Math.max(...this.populationHistory);
        const minPop = Math.min(...this.populationHistory);
        const range = maxPop - minPop || 1;
        
        ctx.strokeStyle = '#00d9ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const pointsToShow = Math.min(this.populationHistory.length, 100);
        const startIndex = Math.max(0, this.populationHistory.length - pointsToShow);
        
        for (let i = 0; i < pointsToShow; i++) {
            const dataIndex = startIndex + i;
            const x = (width / (pointsToShow - 1)) * i;
            const normalizedValue = (this.populationHistory[dataIndex] - minPop) / range;
            const y = height - (normalizedValue * height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // Draw current generation marker
        if (this.generation < this.populationHistory.length) {
            const currentIndex = Math.max(0, this.generation - startIndex);
            if (currentIndex >= 0 && currentIndex < pointsToShow) {
                const x = (width / (pointsToShow - 1)) * currentIndex;
                const normalizedValue = (this.populationHistory[this.generation] - minPop) / range;
                const y = height - (normalizedValue * height);
                
                ctx.fillStyle = '#e94560';
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    
    drawRateChart() {
        const canvas = this.rateChart;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Clear canvas
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, width, height);
        
        if (this.birthHistory.length < 2) return;
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = (height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        const maxRate = Math.max(...this.birthHistory, ...this.deathHistory);
        const pointsToShow = Math.min(this.birthHistory.length, 100);
        const startIndex = Math.max(0, this.birthHistory.length - pointsToShow);
        
        // Draw birth rate line
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < pointsToShow; i++) {
            const dataIndex = startIndex + i;
            const x = (width / (pointsToShow - 1)) * i;
            const y = height - ((this.birthHistory[dataIndex] / maxRate) * height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // Draw death rate line
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < pointsToShow; i++) {
            const dataIndex = startIndex + i;
            const x = (width / (pointsToShow - 1)) * i;
            const y = height - ((this.deathHistory[dataIndex] / maxRate) * height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
    
    drawEntropyChart() {
        const canvas = this.entropyChart;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Clear canvas
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, width, height);
        
        if (this.entropyHistory.length < 2) return;
        
        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const y = (height / 5) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        const maxEntropy = Math.max(...this.entropyHistory);
        const pointsToShow = Math.min(this.entropyHistory.length, 100);
        const startIndex = Math.max(0, this.entropyHistory.length - pointsToShow);
        
        // Draw entropy line
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        for (let i = 0; i < pointsToShow; i++) {
            const dataIndex = startIndex + i;
            const x = (width / (pointsToShow - 1)) * i;
            const y = height - ((this.entropyHistory[dataIndex] / (maxEntropy || 1)) * height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // Draw current generation marker
        if (this.generation < this.entropyHistory.length) {
            const currentIndex = Math.max(0, this.generation - startIndex);
            if (currentIndex >= 0 && currentIndex < pointsToShow) {
                const x = (width / (pointsToShow - 1)) * currentIndex;
                const y = height - ((this.entropyHistory[this.generation] / (maxEntropy || 1)) * height);
                
                ctx.fillStyle = '#e94560';
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }
    
    updateProgressBar() {
        const progressBar = document.getElementById('progressFill');
        const progressThumb = document.getElementById('progressThumb');
        const currentGenLabel = document.getElementById('currentGenLabel');
        const maxGenLabel = document.getElementById('maxGenLabel');
        
        const maxGen = this.history.length - 1;
        const progress = maxGen > 0 ? (this.generation / maxGen) * 100 : 0;
        
        progressBar.style.width = progress + '%';
        progressThumb.style.left = progress + '%';
        
        currentGenLabel.textContent = `Current: ${this.generation}`;
        maxGenLabel.textContent = `Max: ${maxGen}`;
    }
    
    render() {
        // Clear canvas
        this.ctx.fillStyle = this.colors.dead;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid lines
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 0.5;
        
        // Vertical lines
        for (let col = 0; col <= this.cols; col++) {
            const x = col * this.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Horizontal lines
        for (let row = 0; row <= this.rows; row++) {
            const y = row * this.cellSize;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        // Draw cells with age coloring and activity heat map
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const x = col * this.cellSize + 1;
                const y = row * this.cellSize + 1;
                const size = this.cellSize - 2;
                
                // Draw activity heat map background
                const activity = this.activityMap[row][col];
                if (activity > 0.1) {
                    const activityAlpha = Math.min(activity / 10, 0.3);
                    this.ctx.fillStyle = `rgba(255, 165, 0, ${activityAlpha})`;
                    this.ctx.fillRect(x, y, size, size);
                }
                
                // Draw living cells with age coloring
                if (this.grid[row][col] === 1) {
                    const age = this.cellAges[row][col];
                    const color = this.getAgeColor(age);
                    
                    // Add subtle glow effect
                    this.ctx.shadowColor = color;
                    this.ctx.shadowBlur = 2;
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(x, y, size, size);
                    
                    // Reset shadow
                    this.ctx.shadowBlur = 0;
                }
            }
        }
        
        // Draw hover effect
        if (this.hoverCell && !this.isRunning) {
            const { row, col } = this.hoverCell;
            this.ctx.fillStyle = this.colors.hover;
            this.ctx.globalAlpha = 0.3;
            this.ctx.fillRect(
                col * this.cellSize + 1,
                row * this.cellSize + 1,
                this.cellSize - 2,
                this.cellSize - 2
            );
            this.ctx.globalAlpha = 1;
        }
    }
    
    updateStats() {
        const livingCells = this.countLivingCells();
        const populationChange = livingCells - this.previousPopulation;
        
        // Calculate average population
        const avgPopulation = this.populationHistory.length > 0 
            ? Math.round(this.populationHistory.reduce((a, b) => a + b, 0) / this.populationHistory.length)
            : 0;
        
        // Get recent birth and death rates
        const recentBirths = this.birthHistory.length > 0 ? this.birthHistory[this.birthHistory.length - 1] : 0;
        const recentDeaths = this.deathHistory.length > 0 ? this.deathHistory[this.deathHistory.length - 1] : 0;
        
        // Determine stability status
        let stabilityStatus = 'New';
        if (this.generation > 10) {
            if (this.stabilityCounter > 3) {
                stabilityStatus = 'Oscillating';
            } else if (populationChange === 0 && recentBirths === 0 && recentDeaths === 0) {
                stabilityStatus = 'Still Life';
            } else if (Math.abs(populationChange) < 2) {
                stabilityStatus = 'Stable';
            } else {
                stabilityStatus = 'Evolving';
            }
        }
        
        // Update DOM elements
        document.getElementById('generationCount').textContent = this.generation;
        document.getElementById('livingCells').textContent = livingCells;
        document.getElementById('populationChange').textContent = 
            populationChange > 0 ? `+${populationChange}` : populationChange;
        document.getElementById('maxPopulation').textContent = this.maxPopulation;
        document.getElementById('avgPopulation').textContent = avgPopulation;
        document.getElementById('birthRate').textContent = recentBirths;
        document.getElementById('deathRate').textContent = recentDeaths;
        document.getElementById('stability').textContent = stabilityStatus;
        
        // Update entropy display
        const currentEntropy = this.entropyHistory.length > 0 
            ? this.entropyHistory[this.entropyHistory.length - 1] 
            : 0;
        document.getElementById('entropy').textContent = currentEntropy.toFixed(2);
        
        this.previousPopulation = livingCells;
    }
    
    countLivingCells() {
        let count = 0;
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                count += this.grid[row][col];
            }
        }
        return count;
    }
    
    reset() {
        this.grid = this.createEmptyGrid();
        this.generation = 0;
        this.previousPopulation = 0;
        
        // Reset all statistics
        this.history = [];
        this.populationHistory = [];
        this.birthHistory = [];
        this.deathHistory = [];
        this.entropyHistory = [];
        this.maxPopulation = 0;
        this.stabilityCounter = 0;
        this.lastFewStates = [];
        
        // Reset advanced features
        this.cellAges = this.createEmptyGrid();
        this.activityMap = this.createEmptyGrid();
        
        // Initialize entropy for reset state
        const initialEntropy = this.calculateEntropy();
        this.entropyHistory.push(initialEntropy);
        
        this.saveState(); // Save initial empty state
        this.updateStats();
        this.updateCharts();
        this.render();
    }
    
    randomize() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                this.grid[row][col] = Math.random() < 0.3 ? 1 : 0;
            }
        }
        this.generation = 0;
        this.previousPopulation = 0;
        
        // Reset statistics and recalculate entropy
        this.entropyHistory = [];
        const initialEntropy = this.calculateEntropy();
        this.entropyHistory.push(initialEntropy);
        
        this.updateStats();
        this.updateCharts();
        this.render();
    }
    
    start() {
        this.isRunning = true;
        this.gameLoop();
    }
    
    stop() {
        this.isRunning = false;
    }
    
    step() {
        this.nextGeneration();
    }
    
    gameLoop(currentTime = 0) {
        if (!this.isRunning) return;
        
        const deltaTime = currentTime - this.lastUpdate;
        const targetInterval = 1000 / this.speed;
        
        if (deltaTime >= targetInterval) {
            this.nextGeneration();
            this.lastUpdate = currentTime;
        }
        
        requestAnimationFrame((time) => this.gameLoop(time));
    }
    
    setSpeed(speed) {
        this.speed = speed;
    }
    
    // Preset patterns
    addPattern(pattern, startRow, startCol) {
        for (let row = 0; row < pattern.length; row++) {
            for (let col = 0; col < pattern[row].length; col++) {
                const targetRow = startRow + row;
                const targetCol = startCol + col;
                
                if (targetRow >= 0 && targetRow < this.rows && 
                    targetCol >= 0 && targetCol < this.cols) {
                    this.grid[targetRow][targetCol] = pattern[row][col];
                }
            }
        }
        this.render();
        this.updateStats();
    }
    
    // Import/Export functionality
    exportPattern() {
        const livingCells = [];
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.grid[row][col] === 1) {
                    livingCells.push([row, col]);
                }
            }
        }
        
        const patternData = {
            name: `Game of Life Pattern - ${new Date().toISOString().split('T')[0]}`,
            description: `Exported pattern with ${livingCells.length} living cells`,
            gridSize: {
                rows: this.rows,
                cols: this.cols
            },
            generation: this.generation,
            livingCells: livingCells,
            statistics: {
                maxPopulation: this.maxPopulation,
                currentPopulation: this.countLivingCells(),
                totalGenerations: this.generation
            },
            exportDate: new Date().toISOString(),
            version: "1.0"
        };
        
        return JSON.stringify(patternData, null, 2);
    }
    
    importPattern(patternData) {
        try {
            const data = typeof patternData === 'string' ? JSON.parse(patternData) : patternData;
            
            // Validate the data structure
            if (!data.livingCells || !Array.isArray(data.livingCells)) {
                throw new Error('Invalid pattern data: missing or invalid livingCells array');
            }
            
            // Reset the game
            this.reset();
            
            // Import the living cells
            for (const [row, col] of data.livingCells) {
                if (row >= 0 && row < this.rows && col >= 0 && col < this.cols) {
                    this.grid[row][col] = 1;
                }
            }
            
            // Update the display
            this.saveState(); // Save the imported state
            this.updateStats();
            this.updateCharts();
            this.render();
            
            return {
                success: true,
                message: `Successfully imported pattern with ${data.livingCells.length} living cells`,
                data: data
            };
            
        } catch (error) {
            return {
                success: false,
                message: `Import failed: ${error.message}`,
                error: error
            };
        }
    }
    
    downloadPattern() {
        const patternJson = this.exportPattern();
        const blob = new Blob([patternJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `game-of-life-pattern-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Preset patterns
const patterns = {
    glider: [
        [0, 1, 0],
        [0, 0, 1],
        [1, 1, 1]
    ],
    
    blinker: [
        [1, 1, 1]
    ],
    
    toad: [
        [0, 1, 1, 1],
        [1, 1, 1, 0]
    ],
    
    beacon: [
        [1, 1, 0, 0],
        [1, 1, 0, 0],
        [0, 0, 1, 1],
        [0, 0, 1, 1]
    ],
    
    pulsar: [
        [0,0,1,1,1,0,0,0,1,1,1,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,0,0,0,0,1,0,1,0,0,0,0,1],
        [1,0,0,0,0,1,0,1,0,0,0,0,1],
        [1,0,0,0,0,1,0,1,0,0,0,0,1],
        [0,0,1,1,1,0,0,0,1,1,1,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,1,1,1,0,0,0,1,1,1,0,0],
        [1,0,0,0,0,1,0,1,0,0,0,0,1],
        [1,0,0,0,0,1,0,1,0,0,0,0,1],
        [1,0,0,0,0,1,0,1,0,0,0,0,1],
        [0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,1,1,1,0,0,0,1,1,1,0,0]
    ],
    
    gosperGun: [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
        [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
        [1,1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [1,1,0,0,0,0,0,0,0,0,1,0,0,0,1,0,1,1,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ]
};

// Initialize game when page loads
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new GameOfLife(canvas);
    
    // Control buttons
    const playPauseBtn = document.getElementById('playPauseBtn');
    const stepBtn = document.getElementById('stepBtn');
    const resetBtn = document.getElementById('resetBtn');
    const randomBtn = document.getElementById('randomBtn');
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    
    // Import/Export elements
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const fileInput = document.getElementById('fileInput');
    
    // Grid control elements
    const gridWidth = document.getElementById('gridWidth');
    const gridHeight = document.getElementById('gridHeight');
    const applyGridBtn = document.getElementById('applyGridBtn');
    
    // Modal elements
    const introBtn = document.getElementById('introBtn');
    const introModal = document.getElementById('introModal');
    const closeModal = document.getElementById('closeModal');
    
    // Progress bar elements
    const progressBar = document.getElementById('progressBar');
    const progressThumb = document.getElementById('progressThumb');
    let isDragging = false;
    
    // Music elements
    const musicControl = document.getElementById('musicControl');
    const musicIcon = document.getElementById('musicIcon');
    const backgroundMusic = document.getElementById('backgroundMusic');
    let isMusicPlaying = false;
    
    // Chart modal elements
    const chartModal = document.getElementById('chartModal');
    const chartModalTitle = document.getElementById('chartModalTitle');
    const chartModalClose = document.getElementById('chartModalClose');
    const chartModalCanvas = document.getElementById('chartModalCanvas');
    const chartLegend = document.getElementById('chartLegend');
    let currentModalChart = null;
    
    // Game control event listeners
    playPauseBtn.addEventListener('click', () => {
        if (game.isRunning) {
            game.stop();
            playPauseBtn.textContent = 'Play';
            playPauseBtn.classList.remove('active');
            game.playSound(330, 0.15, 'triangle'); // Stop sound
        } else {
            game.start();
            playPauseBtn.textContent = 'Pause';
            playPauseBtn.classList.add('active');
            game.playSound(523, 0.15, 'triangle'); // Play sound
        }
    });
    
    stepBtn.addEventListener('click', () => {
        if (!game.isRunning) {
            game.step();
            game.playSound(660, 0.08, 'sine'); // Step sound
        }
    });
    
    resetBtn.addEventListener('click', () => {
        game.stop();
        game.reset();
        playPauseBtn.textContent = 'Play';
        playPauseBtn.classList.remove('active');
        game.playSound(220, 0.2, 'sawtooth'); // Reset sound
    });
    
    randomBtn.addEventListener('click', () => {
        game.randomize();
        game.playSound(1760, 0.3, 'noise'); // Random sound (will fallback to 'square' if noise not supported)
    });
    
    speedSlider.addEventListener('input', (e) => {
        const speed = parseInt(e.target.value);
        game.setSpeed(speed);
        speedValue.textContent = speed;
    });
    
    // Import/Export event listeners
    exportBtn.addEventListener('click', () => {
        game.downloadPattern();
        showNotification('Pattern exported successfully!', 'success');
    });
    
    importBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const result = game.importPattern(event.target.result);
                if (result.success) {
                    showNotification(result.message, 'success');
                } else {
                    showNotification(result.message, 'error');
                }
            } catch (error) {
                showNotification(`Import failed: ${error.message}`, 'error');
            }
        };
        reader.readAsText(file);
        
        // Reset file input so the same file can be selected again
        e.target.value = '';
    });
    
    // Grid control event listeners
    applyGridBtn.addEventListener('click', () => {
        const newWidth = parseInt(gridWidth.value);
        const newHeight = parseInt(gridHeight.value);
        
        if (newWidth >= 20 && newWidth <= 200 && newHeight >= 20 && newHeight <= 120) {
            game.resizeGrid(newWidth, newHeight);
            showNotification(`Grid resized to ${newWidth}×${newHeight}`, 'success');
        } else {
            showNotification('Grid dimensions must be between 20-200 (width) and 20-120 (height)', 'error');
        }
    });
    
    // Modal event listeners
    introBtn.addEventListener('click', () => {
        introModal.classList.add('active');
    });
    
    closeModal.addEventListener('click', () => {
        introModal.classList.remove('active');
    });
    
    introModal.addEventListener('click', (e) => {
        if (e.target === introModal) {
            introModal.classList.remove('active');
        }
    });
    
    // Ambient music system using Web Audio API
    let audioContext = null;
    let oscillators = [];
    let masterGain = null;
    
    function createAmbientMusic() {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioContext.createGain();
            masterGain.connect(audioContext.destination);
            masterGain.gain.setValueAtTime(0.05, audioContext.currentTime);
            
            // Create multiple oscillators for rich ambient sound
            const frequencies = [110, 165, 220, 330]; // A2, E3, A3, E4
            
            frequencies.forEach((freq, index) => {
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                
                oscillator.connect(gain);
                gain.connect(masterGain);
                
                oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
                oscillator.type = 'sine';
                gain.gain.setValueAtTime(0.3 / frequencies.length, audioContext.currentTime);
                
                // Add subtle frequency modulation for organic feel
                const lfo = audioContext.createOscillator();
                const lfoGain = audioContext.createGain();
                lfo.connect(lfoGain);
                lfoGain.connect(oscillator.frequency);
                lfo.frequency.setValueAtTime(0.1 + index * 0.05, audioContext.currentTime);
                lfoGain.gain.setValueAtTime(0.5, audioContext.currentTime);
                
                oscillator.start();
                lfo.start();
                
                oscillators.push({ oscillator, gain, lfo });
            });
        }
    }
    
    function stopAmbientMusic() {
        if (oscillators.length > 0) {
            oscillators.forEach(({ oscillator, lfo }) => {
                oscillator.stop();
                lfo.stop();
            });
            oscillators = [];
        }
    }
    
    // Music control - Updated to use MP3 file
    musicControl.addEventListener('click', async () => {
        if (isMusicPlaying) {
            backgroundMusic.pause();
            musicIcon.textContent = '♪';
            musicControl.classList.remove('playing');
            isMusicPlaying = false;
        } else {
            try {
                await backgroundMusic.play();
                musicIcon.textContent = '♫';
                musicControl.classList.add('playing');
                isMusicPlaying = true;
            } catch (error) {
                console.log('Audio playback failed:', error);
                // Fallback to Web Audio API if MP3 fails
                try {
                    createAmbientMusic();
                    
                    if (audioContext && audioContext.state === 'suspended') {
                        await audioContext.resume();
                    }
                    
                    musicIcon.textContent = '♫';
                    musicControl.classList.add('playing');
                    isMusicPlaying = true;
                } catch (fallbackError) {
                    console.log('Fallback audio also failed');
                }
            }
        }
    });
    
    // Progress bar interaction for time travel
    function handleProgressBarClick(e) {
        const rect = progressBar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const targetGen = Math.floor(percentage * (game.history.length - 1));
        game.goToGeneration(targetGen);
    }
    
    function handleProgressBarDrag(e) {
        if (!isDragging) return;
        
        const rect = progressBar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const targetGen = Math.floor(percentage * (game.history.length - 1));
        game.goToGeneration(targetGen);
    }
    
    // Progress bar event listeners
    progressBar.addEventListener('click', handleProgressBarClick);
    
    progressThumb.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', handleProgressBarDrag);
    
    document.addEventListener('mouseup', () => {
        isDragging = false;
    });
    
    // Touch events for mobile
    progressBar.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = progressBar.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const targetGen = Math.floor(percentage * (game.history.length - 1));
        game.goToGeneration(targetGen);
    });
    
    progressThumb.addEventListener('touchstart', (e) => {
        isDragging = true;
        e.preventDefault();
    });
    
    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        const touch = e.touches[0];
        const rect = progressBar.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const percentage = Math.max(0, Math.min(1, x / rect.width));
        const targetGen = Math.floor(percentage * (game.history.length - 1));
        game.goToGeneration(targetGen);
    });
    
    document.addEventListener('touchend', () => {
        isDragging = false;
    });
    
    // Chart fullscreen functionality
    document.querySelectorAll('.chart-container').forEach(container => {
        container.addEventListener('click', (e) => {
            if (e.target.classList.contains('chart-expand-btn')) {
                const chartType = container.getAttribute('data-chart');
                openChartModal(chartType);
            }
        });
    });
    
    chartModalClose.addEventListener('click', () => {
        chartModal.classList.remove('active');
        currentModalChart = null;
    });
    
    chartModal.addEventListener('click', (e) => {
        if (e.target === chartModal) {
            chartModal.classList.remove('active');
            currentModalChart = null;
        }
    });
    
    function openChartModal(chartType) {
        currentModalChart = chartType;
        
        if (chartType === 'population') {
            chartModalTitle.textContent = 'Population Over Time';
            setupChartLegend([
                { color: '#00d9ff', label: 'Population' },
                { color: '#e94560', label: 'Current Generation' }
            ]);
        } else if (chartType === 'rate') {
            chartModalTitle.textContent = 'Birth/Death Rates Over Time';
            setupChartLegend([
                { color: '#00ff88', label: 'Birth Rate' },
                { color: '#ff6b6b', label: 'Death Rate' }
            ]);
        } else if (chartType === 'entropy') {
            chartModalTitle.textContent = 'System Entropy Over Time';
            setupChartLegend([
                { color: '#f39c12', label: 'Entropy Level' }
            ]);
        }
        
        chartModal.classList.add('active');
        
        // Resize modal canvas and redraw
        setTimeout(() => {
            resizeModalChart();
            drawModalChart();
        }, 100);
    }
    
    function setupChartLegend(items) {
        chartLegend.innerHTML = items.map(item => 
            `<div class="legend-item">
                <div class="legend-color" style="background-color: ${item.color}"></div>
                <span>${item.label}</span>
            </div>`
        ).join('');
    }
    
    function resizeModalChart() {
        const container = chartModalCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        chartModalCanvas.style.width = rect.width + 'px';
        chartModalCanvas.style.height = rect.height + 'px';
        
        chartModalCanvas.width = rect.width * dpr;
        chartModalCanvas.height = rect.height * dpr;
        
        const ctx = chartModalCanvas.getContext('2d');
        ctx.scale(dpr, dpr);
    }
    
    function drawModalChart() {
        if (!currentModalChart) return;
        
        if (currentModalChart === 'population') {
            drawFullscreenPopulationChart();
        } else if (currentModalChart === 'rate') {
            drawFullscreenRateChart();
        } else if (currentModalChart === 'entropy') {
            drawFullscreenEntropyChart();
        }
    }
    
    // Preset pattern buttons (updated for new structure)
    document.querySelectorAll('.preset-item').forEach(item => {
        item.addEventListener('click', () => {
            const patternName = item.getAttribute('data-preset');
            const pattern = patterns[patternName];
            
            if (pattern) {
                // Place pattern in center of grid
                const startRow = Math.floor((game.rows - pattern.length) / 2);
                const startCol = Math.floor((game.cols - pattern[0].length) / 2);
                
                game.reset();
                game.addPattern(pattern, startRow, startCol);
                game.playSound(440, 0.1, 'square'); // Pattern selection sound
            }
        });
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        switch(e.key) {
            case ' ':
                e.preventDefault();
                playPauseBtn.click();
                break;
            case 'r':
                resetBtn.click();
                break;
            case 's':
                stepBtn.click();
                break;
            case 'g':
                randomBtn.click();
                break;
            case 'Escape':
                if (introModal.classList.contains('active')) {
                    introModal.classList.remove('active');
                }
                if (chartModal.classList.contains('active')) {
                    chartModal.classList.remove('active');
                    currentModalChart = null;
                }
                break;
            case 'e':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    exportBtn.click();
                }
                break;
            case 'i':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    importBtn.click();
                }
                break;
        }
    });
    
    // Show introduction modal on first visit
    if (!localStorage.getItem('gameOfLifeVisited')) {
        setTimeout(() => {
            introModal.classList.add('active');
            localStorage.setItem('gameOfLifeVisited', 'true');
        }, 1000);
    }
    
    // Handle window resize to keep charts properly sized
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            game.resizeCharts();
            game.updateCharts();
        }, 250);
    });
    
    // Fullscreen chart drawing functions with axes and labels
    function drawFullscreenPopulationChart() {
        const canvas = chartModalCanvas;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Margins for axes
        const margin = { top: 40, right: 40, bottom: 60, left: 80 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        
        // Clear canvas
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, width, height);
        
        if (game.populationHistory.length < 2) return;
        
        const maxPop = Math.max(...game.populationHistory);
        const minPop = Math.min(...game.populationHistory);
        const range = maxPop - minPop || 1;
        const maxGen = game.populationHistory.length - 1;
        
        // Draw axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Y-axis
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, height - margin.bottom);
        // X-axis
        ctx.lineTo(width - margin.right, height - margin.bottom);
        ctx.stroke();
        
        // Draw grid lines and labels
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        
        // X-axis labels (generations)
        const xSteps = Math.min(10, maxGen);
        for (let i = 0; i <= xSteps; i++) {
            const gen = Math.round((maxGen / xSteps) * i);
            const x = margin.left + (chartWidth / xSteps) * i;
            
            // Grid line
            ctx.beginPath();
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, height - margin.bottom);
            ctx.stroke();
            
            // Label
            ctx.fillText(gen.toString(), x, height - margin.bottom + 20);
        }
        
        // Y-axis labels (population)
        ctx.textAlign = 'right';
        const ySteps = 8;
        for (let i = 0; i <= ySteps; i++) {
            const value = minPop + (range / ySteps) * i;
            const y = height - margin.bottom - (chartHeight / ySteps) * i;
            
            // Grid line
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(width - margin.right, y);
            ctx.stroke();
            
            // Label
            ctx.fillText(Math.round(value).toString(), margin.left - 10, y + 4);
        }
        
        // Axis labels
        ctx.textAlign = 'center';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText('Generation', width / 2, height - 10);
        
        ctx.save();
        ctx.translate(20, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Population', 0, 0);
        ctx.restore();
        
        // Draw population line
        ctx.strokeStyle = '#00d9ff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        for (let i = 0; i < game.populationHistory.length; i++) {
            const x = margin.left + (chartWidth / maxGen) * i;
            const normalizedValue = (game.populationHistory[i] - minPop) / range;
            const y = height - margin.bottom - (normalizedValue * chartHeight);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        
        // Draw current generation marker
        if (game.generation < game.populationHistory.length) {
            const x = margin.left + (chartWidth / maxGen) * game.generation;
            const normalizedValue = (game.populationHistory[game.generation] - minPop) / range;
            const y = height - margin.bottom - (normalizedValue * chartHeight);
            
            ctx.fillStyle = '#e94560';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    function drawFullscreenRateChart() {
        const canvas = chartModalCanvas;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Margins for axes
        const margin = { top: 40, right: 40, bottom: 60, left: 80 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        
        // Clear canvas
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, width, height);
        
        if (game.birthHistory.length < 2) return;
        
        const maxRate = Math.max(...game.birthHistory, ...game.deathHistory);
        const maxGen = game.birthHistory.length - 1;
        
        // Draw axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Y-axis
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, height - margin.bottom);
        // X-axis
        ctx.lineTo(width - margin.right, height - margin.bottom);
        ctx.stroke();
        
        // Draw grid lines and labels
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        
        // X-axis labels (generations)
        const xSteps = Math.min(10, maxGen);
        for (let i = 0; i <= xSteps; i++) {
            const gen = Math.round((maxGen / xSteps) * i);
            const x = margin.left + (chartWidth / xSteps) * i;
            
            // Grid line
            ctx.beginPath();
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, height - margin.bottom);
            ctx.stroke();
            
            // Label
            ctx.fillText(gen.toString(), x, height - margin.bottom + 20);
        }
        
        // Y-axis labels (rates)
        ctx.textAlign = 'right';
        const ySteps = 8;
        for (let i = 0; i <= ySteps; i++) {
            const value = (maxRate / ySteps) * i;
            const y = height - margin.bottom - (chartHeight / ySteps) * i;
            
            // Grid line
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(width - margin.right, y);
            ctx.stroke();
            
            // Label
            ctx.fillText(Math.round(value).toString(), margin.left - 10, y + 4);
        }
        
        // Axis labels
        ctx.textAlign = 'center';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText('Generation', width / 2, height - 10);
        
        ctx.save();
        ctx.translate(20, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Rate (Cells/Generation)', 0, 0);
        ctx.restore();
        
        // Draw birth rate line
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        for (let i = 0; i < game.birthHistory.length; i++) {
            const x = margin.left + (chartWidth / maxGen) * i;
            const y = height - margin.bottom - ((game.birthHistory[i] / maxRate) * chartHeight);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        // Draw death rate line
        ctx.strokeStyle = '#ff6b6b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        for (let i = 0; i < game.deathHistory.length; i++) {
            const x = margin.left + (chartWidth / maxGen) * i;
            const y = height - margin.bottom - ((game.deathHistory[i] / maxRate) * chartHeight);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
    
    function drawFullscreenEntropyChart() {
        const canvas = chartModalCanvas;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        // Margins for axes
        const margin = { top: 40, right: 40, bottom: 60, left: 80 };
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;
        
        // Clear canvas
        ctx.fillStyle = '#0f0f23';
        ctx.fillRect(0, 0, width, height);
        
        if (game.entropyHistory.length < 2) return;
        
        const maxEntropy = Math.max(...game.entropyHistory);
        const maxGen = game.entropyHistory.length - 1;
        
        // Draw axes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Y-axis
        ctx.moveTo(margin.left, margin.top);
        ctx.lineTo(margin.left, height - margin.bottom);
        // X-axis
        ctx.lineTo(width - margin.right, height - margin.bottom);
        ctx.stroke();
        
        // Draw grid lines and labels
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '12px Inter, sans-serif';
        ctx.textAlign = 'center';
        
        // X-axis labels (generations)
        const xSteps = Math.min(10, maxGen);
        for (let i = 0; i <= xSteps; i++) {
            const gen = Math.round((maxGen / xSteps) * i);
            const x = margin.left + (chartWidth / xSteps) * i;
            
            // Grid line
            ctx.beginPath();
            ctx.moveTo(x, margin.top);
            ctx.lineTo(x, height - margin.bottom);
            ctx.stroke();
            
            // Label
            ctx.fillText(gen.toString(), x, height - margin.bottom + 20);
        }
        
        // Y-axis labels (entropy)
        ctx.textAlign = 'right';
        const ySteps = 8;
        for (let i = 0; i <= ySteps; i++) {
            const value = (maxEntropy / ySteps) * i;
            const y = height - margin.bottom - (chartHeight / ySteps) * i;
            
            // Grid line
            ctx.beginPath();
            ctx.moveTo(margin.left, y);
            ctx.lineTo(width - margin.right, y);
            ctx.stroke();
            
            // Label
            ctx.fillText(value.toFixed(2), margin.left - 10, y + 4);
        }
        
        // Axis labels
        ctx.textAlign = 'center';
        ctx.font = '14px Inter, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.fillText('Generation', width / 2, height - 10);
        
        ctx.save();
        ctx.translate(20, height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Entropy', 0, 0);
        ctx.restore();
        
        // Draw entropy line
        ctx.strokeStyle = '#f39c12';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        for (let i = 0; i < game.entropyHistory.length; i++) {
            const x = margin.left + (chartWidth / maxGen) * i;
            const y = height - margin.bottom - ((game.entropyHistory[i] / maxEntropy) * chartHeight);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
    }
    
    // Notification system
    function showNotification(message, type = 'info', duration = 3000) {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());
        
        // Create new notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Hide and remove notification
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, duration);
    }
    
    // Settings modal functionality - Set up immediately
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    
    if (settingsBtn && settingsModal && closeSettings) {
        settingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('active');
            if (game && game.playSound) {
                game.playSound(880, 0.1, 'sine');
            }
        });
        
        closeSettings.addEventListener('click', () => {
            settingsModal.classList.remove('active');
        });
        
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                settingsModal.classList.remove('active');
            }
        });
    } else {
        console.error('Settings elements not found:', { settingsBtn, settingsModal, closeSettings });
    }

    // Fullscreen mode functionality - Set up immediately
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    let isFullscreen = false;
    
    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', () => {
            isFullscreen = !isFullscreen;
            
            if (isFullscreen) {
                document.body.classList.add('fullscreen');
                fullscreenBtn.textContent = 'Exit Fullscreen';
                if (game && game.playSound) {
                    game.playSound(1320, 0.15, 'sawtooth');
                }
            } else {
                document.body.classList.remove('fullscreen');
                fullscreenBtn.textContent = 'Fullscreen';
                if (game && game.playSound) {
                    game.playSound(880, 0.15, 'sawtooth');
                }
            }
            
            // Resize canvas for fullscreen
            setTimeout(() => {
                if (game && game.render) {
                    game.render();
                }
            }, 100);
        });
        
        // ESC key to exit fullscreen
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isFullscreen) {
                isFullscreen = false;
                document.body.classList.remove('fullscreen');
                fullscreenBtn.textContent = 'Fullscreen';
                setTimeout(() => {
                    if (game && game.render) {
                        game.render();
                    }
                }, 100);
            }
        });
    } else {
        console.error('Fullscreen button not found');
    }

    // Initial chart setup after a short delay to ensure DOM is ready
    setTimeout(() => {
        game.resizeCharts();
        game.updateCharts();
        
        // Initialize other settings functionality after game is ready
        initializeAdvancedSettings();
    }, 100);
    
    function initializeAdvancedSettings() {

        // Theme selection
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all theme buttons
                document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Apply theme
                const theme = btn.getAttribute('data-theme');
                document.body.className = `theme-${theme}`;
                
                // Update game colors based on theme
                const computedStyles = getComputedStyle(document.body);
                const aliveColor = computedStyles.getPropertyValue('--cell-alive').trim();
                const deadColor = computedStyles.getPropertyValue('--cell-dead').trim();
                const gridColor = computedStyles.getPropertyValue('--border-primary').trim();
                
                game.updateColors(aliveColor, deadColor, gridColor);
                game.playSound(1100, 0.1, 'square');
            });
        });

        // Color customization
        const aliveColorPicker = document.getElementById('aliveColor');
        const deadColorPicker = document.getElementById('deadColor');
        const gridColorPicker = document.getElementById('gridColor');
        
        aliveColorPicker.addEventListener('change', (e) => {
            game.updateColors(e.target.value, game.colors.dead, game.colors.grid);
            game.playSound(800, 0.1, 'sine');
        });
        
        deadColorPicker.addEventListener('change', (e) => {
            game.updateColors(game.colors.alive, e.target.value, game.colors.grid);
            game.playSound(600, 0.1, 'sine');
        });
        
        gridColorPicker.addEventListener('change', (e) => {
            game.updateColors(game.colors.alive, game.colors.dead, e.target.value);
            game.playSound(400, 0.1, 'sine');
        });

        // Sound settings
        const soundEffectsToggle = document.getElementById('soundEffects');
        const volumeSlider = document.getElementById('volumeSlider');
        const volumeValue = document.getElementById('volumeValue');
        
        soundEffectsToggle.addEventListener('change', (e) => {
            game.soundEnabled = e.target.checked;
            if (game.soundEnabled) {
                game.playSound(880, 0.1, 'sine');
            }
        });
        
        volumeSlider.addEventListener('input', (e) => {
            game.soundVolume = e.target.value / 100;
            volumeValue.textContent = e.target.value + '%';
            game.playSound(440, 0.1, 'sine');
        });

    }
});
