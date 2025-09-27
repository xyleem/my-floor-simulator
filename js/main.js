/**
 * @file main.js
 * @description Refactored code for the Wood Flooring Layout Simulator.
 * [UPDATE] Added a text label "門" to the door opening graphic.
 */
const FlooringSimulator = {
    // --- PROPERTIES ---
    dom: {},
    state: {
        lastRenderWidth: 0,
        lastRenderHeight: 0
    },
    ctx: null,

    // --- CONSTANTS ---
    RENDER_PADDING: 80,
    EPSILON: 1e-9,

    // --- INITIALIZATION ---
    init() {
        this.collectDOMElements();
        if (!this.dom.canvas2d) {
            console.error("Canvas element not found. Aborting initialization.");
            return;
        }
        this.ctx = this.dom.canvas2d.getContext('2d');
        this.bindEvents();
        this.setupResizeObserver();
        this.UI.updateAllStates(this);
        this.update();
    },

    collectDOMElements() {
        const ids = [
            'room-length', 'room-width', 'wall-thickness', 'gap-top', 'gap-bottom', 'gap-left', 'gap-right',
            'floor-board-length', 'floor-board-width', 'planks-per-box', 'min-last-row-width', 'min-sequence-spacing',
            'start-rule-fixed', 'start-rule-fraction', 'min-start-fixed', 'min-start-fraction', 'min-start-fraction-result',
            'manual-first-row-width',
            'layout-pattern-container',
            'canvas-2d', 'viewport-2d', 'details-panel'
        ];
        ids.forEach(id => {
            const camelCaseId = id.replace(/-(\w)/g, (_, c) => c.toUpperCase());
            this.dom[camelCaseId] = document.getElementById(id);
        });
    },

    bindEvents() {
        const inputsToUpdate = [
            'roomLength', 'roomWidth', 'floorBoardLength', 'floorBoardWidth',
            'minLastRowWidth', 'gapTop', 'gapBottom', 'gapLeft', 'gapRight',
            'minStartFixed', 'minStartFraction', 'planksPerBox',
            'minSequenceSpacing', 'manualFirstRowWidth'
        ];
        inputsToUpdate.forEach(key => {
            if (this.dom[key]) this.dom[key].addEventListener('input', () => this.update());
        });

        const changesToUpdate = ['startRuleFixed', 'startRuleFraction'];
        changesToUpdate.forEach(key => {
            if (this.dom[key]) {
                this.dom[key].addEventListener('change', () => {
                    this.UI.updateAllStates(this);
                    this.update();
                });
            }
        });

        if (this.dom.layoutPatternContainer) {
            this.dom.layoutPatternContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('pattern-option')) {
                    e.target.classList.toggle('selected');
                    this.update();
                }
            });
        }
        
        const uiOnlyInputs = ['floorBoardLength', 'minStartFraction', 'floorBoardWidth', 'manualFirstRowWidth'];
         uiOnlyInputs.forEach(key => {
            if (this.dom[key]) this.dom[key].addEventListener('input', () => this.UI.updateAllStates(this));
        });
    },

    setupResizeObserver() {
        if (this.dom.viewport2d) {
            const resizeObserver = new ResizeObserver(() => this.handleResize());
            resizeObserver.observe(this.dom.viewport2d);
        }
    },

    // --- CORE LOGIC ---
    update() {
        this.UI.updateAllStates(this);
        const config = this.getConfig();

        if (!config) {
            this.UI.displayInvalidInputMessage(this);
            this.Renderer.clear(this);
            return;
        }

        const result = this.Calculator.calculateLayout(this, config);
        this.Renderer.render(this, config, result.layout || []);
        this.UI.updateDetailsPanel(this, result, config);

        if (this.dom.viewport2d) {
            this.state.lastRenderWidth = this.dom.viewport2d.clientWidth;
            this.state.lastRenderHeight = this.dom.viewport2d.clientHeight;
        }
    },
    
    handleResize() {
        if (!this.dom.viewport2d) return;
        const { clientWidth, clientHeight } = this.dom.viewport2d;
        if (clientWidth === this.state.lastRenderWidth && clientHeight === this.state.lastRenderHeight) return;
        this.update();
    },

    getConfig() {
        const parseCm = (el) => parseFloat(el.value) / 100;
        
        const config = {
            length: parseCm(this.dom.roomLength),
            width: parseCm(this.dom.roomWidth),
            boardLength: parseCm(this.dom.floorBoardLength),
            boardWidth: parseCm(this.dom.floorBoardWidth),
            wallThickness: parseCm(this.dom.wallThickness),
            gapTop: parseCm(this.dom.gapTop),
            gapBottom: parseCm(this.dom.gapBottom),
            gapLeft: parseCm(this.dom.gapLeft),
            gapRight: parseCm(this.dom.gapRight),
            minLastPieceLength: parseCm(this.dom.minLastRowWidth),
            minSequenceSpacing: parseCm(this.dom.minSequenceSpacing) || 0.276,
            planksPerBox: parseInt(this.dom.planksPerBox.value, 10) || 1,
            manualWidthEnabled: false,
            manualFirstRowWidth: 0
        };

        const manualWidthValue = this.dom.manualFirstRowWidth.value;
        const parsedManualWidth = parseFloat(manualWidthValue) / 100;
        if (manualWidthValue.trim() !== '' && !isNaN(parsedManualWidth) && parsedManualWidth > 0) {
            config.manualWidthEnabled = true;
            config.manualFirstRowWidth = parsedManualWidth;
        }
        
        config.effectiveLength = config.length - config.gapLeft - config.gapRight;
        config.effectiveWidth = config.width - config.gapTop - config.gapBottom;

        if (this.dom.startRuleFixed.checked) {
            config.startRule = { type: 'fixed', value: parseCm(this.dom.minStartFixed) };
        } else {
            config.startRule = { type: 'fraction', value: parseInt(this.dom.minStartFraction.value) };
        }
        config.minStartLength = config.startRule.type === 'fixed' 
            ? config.startRule.value 
            : (config.boardLength / (config.startRule.value || 1));

        const selectedNodes = document.querySelectorAll('.pattern-option.selected');
        config.selectedPatterns = Array.from(selectedNodes).map(n => ({ value: n.dataset.value, text: n.textContent }));
        
        const allNumericValues = Object.values(config).filter(v => typeof v === 'number');
        if (allNumericValues.some(isNaN) || (config.startRule.value && isNaN(config.startRule.value))) return null;
        
        return config;
    },

    // --- UI MANAGEMENT MODULE ---
    UI: {
        updateAllStates(app) {
            this.validateManualWidthInput(app);
            this.updateRuleState(app);
            this.updateFractionResult(app);
        },
        
        validateManualWidthInput(app) {
            const { manualFirstRowWidth, floorBoardWidth } = app.dom;

            if (!manualFirstRowWidth || !floorBoardWidth || manualFirstRowWidth.value.trim() === '') {
                return;
            }

            let manualWidth = parseFloat(manualFirstRowWidth.value);
            const boardWidth = parseFloat(floorBoardWidth.value);

            if (!isNaN(manualWidth) && manualWidth < 0) {
                manualWidth = 0;
                manualFirstRowWidth.value = '0';
            }

            if (!isNaN(manualWidth) && !isNaN(boardWidth) && manualWidth > boardWidth) {
                manualFirstRowWidth.value = boardWidth.toFixed(1);
            }
        },

        updateRuleState(app) {
            const isFixed = app.dom.startRuleFixed.checked;
            app.dom.minStartFixed.disabled = !isFixed;
            app.dom.minStartFraction.disabled = isFixed;
        },

        updateFractionResult(app) {
            const { minStartFractionResult, startRuleFraction, floorBoardLength, minStartFraction } = app.dom;
            if (startRuleFraction.checked) {
                const boardLength = parseFloat(floorBoardLength.value);
                const fraction = parseInt(minStartFraction.value, 10);
                minStartFractionResult.textContent = (boardLength > 0 && fraction > 0)
                    ? `= ${(boardLength / fraction).toFixed(1)} cm` : '';
            } else {
                minStartFractionResult.textContent = '';
            }
        },
        
        displayInvalidInputMessage(app) {
            const panel = app.dom.detailsPanel;
            panel.innerHTML = `<h4>鋪設方案細節</h4><p style="padding: 15px; text-align: center; opacity: 0.7; font-style: italic;">請輸入有效的參數</p>`;
            panel.style.display = 'block';
        },
        
        updateDetailsPanel(app, result, config) {
            const panel = app.dom.detailsPanel;
            if (!result || !result.startLengthAnalysis) {
                const selectedCount = document.querySelectorAll('.pattern-option.selected').length;
                const message = selectedCount > 0 
                    ? `所選方案組合無法產生有效的鋪設序列` 
                    : `請選擇鋪設方案以查看細節`;
                panel.innerHTML = `<h4>鋪設方案細節</h4><p style="padding: 15px; text-align: center; opacity: 0.7; font-style: italic;">${message}</p>`;
                panel.style.display = 'block';
                return;
            }

            const { patternText, startLengthAnalysis, layout, plankCount, boxesNeeded } = result;
            const finalSequenceLength = startLengthAnalysis.length;
            
            let listItemsHTML = startLengthAnalysis.map(item => {
                const lenInCm = (item.length * 100).toFixed(1);
                
                if (item.isValid) {
                    if (item.highlight) {
                        return `<li><strong style="color: #ff8080;">${lenInCm} cm</strong></li>`;
                    } else {
                        return `<li><strong>${lenInCm} cm</strong></li>`;
                    }
                } else {
                    return `<li><span style="text-decoration: line-through; opacity: 0.8;">${lenInCm} cm</span> <span style="font-size: 0.9em; opacity: 0.9;">(${item.reason})</span></li>`;
                }
            }).join('');
            
            let statsHTML = '';
            if (layout && layout.length > 0) {
                const singleBoardArea = config.boardLength * config.boardWidth;
                const totalPurchasedPlanks = boxesNeeded * config.planksPerBox;
                const totalPlankArea = totalPurchasedPlanks * singleBoardArea;
                statsHTML = `
                    <hr style="border-color: rgba(255,255,255,0.3); margin: 15px 0;">
                    <div style="font-size: 14px; line-height: 1.8;">
                        <p style="margin: 0;">預估用量：<span class="detail-value">${totalPlankArea.toFixed(2)} m²</span></p>
                        <p style="margin: 0;">總共片數：<span class="detail-value">${plankCount} 片</span></p>
                        <p style="margin: 0;">預計箱數：<span class="detail-value">${boxesNeeded} 箱</span></p>
                    </div>`;
            }

            panel.innerHTML = `
                <h4>鋪設方案細節</h4>
                <div style="margin-bottom: 15px; font-size: 14px; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 10px;">
                    <p style="margin: 0 0 8px;">有效範圍: <span class="detail-value">${(config.effectiveLength * 100).toFixed(1)}</span> x <span class="detail-value">${(config.effectiveWidth * 100).toFixed(1)}</span> cm</p>
                    <p style="margin: 0;">有效面積: <span class="detail-value">${(config.effectiveLength * config.effectiveWidth).toFixed(2)}</span> m²</p>
                </div>
                <details open style="margin-bottom: 15px;">
                    <summary style="font-weight: bold; cursor: pointer; color: #e0f0ff;">
                        ${patternText} 
                        <span style="font-weight: normal; opacity: 0.8; margin-left: 5px;">(最終序列長度: ${finalSequenceLength})</span>
                    </summary>
                    <ul class="start-lengths-list" style="margin-top: 8px; padding-left: 20px;">${listItemsHTML}</ul>
                    ${statsHTML}
                </details>
            `;
            panel.style.display = 'block';
        }
    },

    // --- CALCULATOR MODULE ---
    Calculator: {
        calculateLayout(app, config) {
            if (!config.selectedPatterns?.length) return null;
            
            const EPSILON = app.EPSILON;

            const preProcessedSequences = config.selectedPatterns.map(pattern => {
                let rawSequence;
                if (pattern.value === 'custom') {
                    rawSequence = [0, 0.66, 0.33, 0.8, 0.2].map(offset => config.boardLength * (1 - offset));
                } else {
                    const divisionCount = parseInt(pattern.value);
                    rawSequence = Array.from({ length: divisionCount }, (_, i) => config.boardLength * (1 - (i / divisionCount)));
                }
                rawSequence.sort((a, b) => b - a);
                
                let passesSpacingTest = true;
                for (let i = 0; i < rawSequence.length - 1; i++) {
                    const spacing = rawSequence[i] - rawSequence[i + 1];
                    if ((config.minSequenceSpacing - spacing) > EPSILON) {
                        passesSpacingTest = false;
                        break;
                    }
                }
                
                let finalSequence = rawSequence;
                if (!passesSpacingTest) {
                    const evenGroup = rawSequence.filter((_, i) => i % 2 === 0);
                    const oddGroup = rawSequence.filter((_, i) => i % 2 !== 0);
                    if (evenGroup.some(len => Math.abs(len - config.boardLength) < EPSILON)) {
                        finalSequence = [...evenGroup, ...oddGroup];
                    } else {
                        finalSequence = [...oddGroup, ...evenGroup];
                    }
                }
                return { patternText: pattern.text, sequence: finalSequence };
            });

            preProcessedSequences.sort((a, b) => b.sequence.length - a.sequence.length);

            const finalSequence = preProcessedSequences.flatMap(p => p.sequence);
            
            const startLengthAnalysis = finalSequence.map(len => {
                const reasons = [];
                if ((config.minStartLength - len) > EPSILON) reasons.push("起始長度不足");
                
                let endPieceLength = (config.effectiveLength - len) % config.boardLength;
                if (Math.abs(endPieceLength) < EPSILON || Math.abs(endPieceLength - config.boardLength) < EPSILON) {
                    endPieceLength = config.boardLength;
                }
                if ((config.minLastPieceLength - endPieceLength) > EPSILON) reasons.push("末片長度不足");
                
                return { length: len, isValid: reasons.length === 0, reason: reasons.join(','), highlight: false };
            });

            const validItemsInFinalSequence = startLengthAnalysis.filter(item => item.isValid);
            if (validItemsInFinalSequence.length > 1) {
                for (let i = 0; i < validItemsInFinalSequence.length - 1; i++) {
                    const spacing = Math.abs(validItemsInFinalSequence[i].length - validItemsInFinalSequence[i+1].length);
                    if ((config.minStartLength - spacing) > EPSILON) {
                        validItemsInFinalSequence[i].highlight = true;
                        validItemsInFinalSequence[i+1].highlight = true;
                    }
                }
                const first = validItemsInFinalSequence[0];
                const last = validItemsInFinalSequence[validItemsInFinalSequence.length - 1];
                const wraparoundSpacing = Math.abs(first.length - last.length);
                if ((config.minStartLength - wraparoundSpacing) > EPSILON) {
                    first.highlight = true;
                    last.highlight = true;
                }
            }
            
            const validSequenceForLayout = startLengthAnalysis
                .filter(item => item.isValid)
                .map(item => item.length);
            
            const patternText = preProcessedSequences.map(p => p.patternText.split(' ')[0]).join(' + ') + ' 混合';

            if (validSequenceForLayout.length === 0) {
                return { startLengthAnalysis: startLengthAnalysis, layout: [], patternText, plankCount: 0, boxesNeeded: 0 };
            }

            const layout = this.generateBoardRows(app, config, validSequenceForLayout);
            const plankCount = layout.length;
            const boxesNeeded = (config.planksPerBox > 0) ? Math.ceil(plankCount / config.planksPerBox) : 0;
            
            return { layout, startLengthAnalysis: startLengthAnalysis, patternText, plankCount, boxesNeeded };
        },
        
        generateBoardRows(app, config, startSequence) {
            const layout = [];
            const finalOffsets = startSequence.map(len => 1 - (len / config.boardLength));
            const { effectiveWidth, effectiveLength, boardWidth, boardLength, gapLeft, gapTop } = config;
            const EPSILON = app.EPSILON;

            let rowWidths = [];

            if (config.manualWidthEnabled) {
                const manualStartRowWidth = config.manualFirstRowWidth;
                let remainingWidth = effectiveWidth - manualStartRowWidth;
                let otherRows = [];
                
                while (remainingWidth > boardWidth + EPSILON) {
                    otherRows.push(boardWidth);
                    remainingWidth -= boardWidth;
                }

                if (remainingWidth > EPSILON) {
                    if (Math.abs(remainingWidth - boardWidth) < EPSILON) {
                        otherRows.push(boardWidth);
                    } else {
                        otherRows.push(remainingWidth);
                    }
                }
                rowWidths = otherRows.reverse().concat([manualStartRowWidth]);

            } else {
                let tempRowWidths = [];
                let remainingWidth = effectiveWidth;

                if (remainingWidth > 0) {
                    const firstWidth = Math.min(boardWidth, remainingWidth);
                    tempRowWidths.push(firstWidth);
                    remainingWidth -= firstWidth;
                }

                while (remainingWidth > boardWidth + EPSILON) {
                    tempRowWidths.push(boardWidth);
                    remainingWidth -= boardWidth;
                }

                if (remainingWidth > EPSILON) {
                     if (Math.abs(remainingWidth - boardWidth) < EPSILON) {
                        tempRowWidths.push(boardWidth);
                    } else {
                        tempRowWidths.push(remainingWidth);
                    }
                }
                
                rowWidths = tempRowWidths.reverse();
            }
            
            let currentY = gapTop;
            for (let i = 0; i < rowWidths.length; i++) {
                const plankHeight = rowWidths[i];

                if (plankHeight < EPSILON) continue;
                
                const offsetIndex = (rowWidths.length - 1 - i);
                const offset = finalOffsets[offsetIndex % finalOffsets.length];
                
                let firstPlankLengthInRow = boardLength * (1 - offset);
                let remainingLengthInRow = effectiveLength;
                let currentX = gapLeft;

                let isFirstPlank = true;
                while(remainingLengthInRow > EPSILON) {
                    const lengthToUse = isFirstPlank ? firstPlankLengthInRow : boardLength;
                    const plankL = Math.min(lengthToUse, remainingLengthInRow);
                    layout.push({ x: currentX, y: currentY, width: plankL, height: plankHeight });
                    currentX += plankL;
                    remainingLengthInRow -= plankL;
                    isFirstPlank = false;
                }
                currentY += plankHeight;
            }
            return layout;
        }
    },
    
    // --- RENDERER MODULE ---
    Renderer: {
        clear(app) {
            const { canvas2d } = app.dom;
            const { ctx } = app;
            if (canvas2d && ctx) {
                 ctx.clearRect(0, 0, canvas2d.width, canvas2d.height);
            }
        },

        render(app, config, layout) {
            const { canvas2d } = app.dom;
            if (!canvas2d) return;
            canvas2d.width = canvas2d.clientWidth;
            canvas2d.height = canvas2d.clientHeight;
            this.clear(app);
            if (!config) return;

            const { length, width, wallThickness } = config;
            const totalLength = length + 2 * wallThickness;
            const totalWidth = width + 2 * wallThickness;
            const PADDING = app.RENDER_PADDING;
            const scale = Math.min((canvas2d.width - PADDING * 2) / totalLength, (canvas2d.height - PADDING * 2) / totalWidth);
            const startX = (canvas2d.width - totalLength * scale) / 2;
            const startY = (canvas2d.height - totalWidth * scale) / 2;
            
            this.drawWallsAndFloor(app, config, scale, startX, startY);
            this.drawPlanks(app, layout, config, scale, startX, startY);
            this.drawLabels(app, layout, config, scale, startX, startY);
            this.drawDoor(app, config, scale, startX, startY);
        },

        drawWallsAndFloor(app, config, scale, startX, startY) {
            const { ctx } = app;
            const { length, width, wallThickness } = config;
            const floorStartX = startX + wallThickness * scale;
            const floorStartY = startY + wallThickness * scale;
            
            ctx.fillStyle = '#555555';
            ctx.fillRect(startX, startY, (length + 2 * wallThickness) * scale, (width + 2 * wallThickness) * scale);
            
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(floorStartX, floorStartY, length * scale, width * scale);
        },
        
        drawPlanks(app, layout, config, scale, startX, startY) {
            const { ctx } = app;
            const floorStartX = startX + config.wallThickness * scale;
            const floorStartY = startY + config.wallThickness * scale;

            ctx.save();
            ctx.beginPath();
            ctx.rect(floorStartX, floorStartY, config.length * scale, config.width * scale);
            ctx.clip();
            
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            layout.forEach(plank => {
                ctx.strokeRect(
                    floorStartX + plank.x * scale, 
                    floorStartY + plank.y * scale, 
                    plank.width * scale, 
                    plank.height * scale
                );
            });
            ctx.restore();
        },

        drawLabels(app, layout, config, scale, startX, startY) {
             const { ctx } = app;
             const floorStartX = startX + config.wallThickness * scale;
             const floorStartY = startY + config.wallThickness * scale;
             const floorRectWidth = config.length * scale;
             const floorRectHeight = config.width * scale;

             ctx.fillStyle = '#333';
             ctx.font = '16px Arial';
             ctx.textAlign = 'center';
             ctx.textBaseline = 'middle';
             ctx.fillText(`${(config.length * 100).toFixed(0)} cm`, floorStartX + floorRectWidth / 2, floorStartY + floorRectHeight + 25);
             ctx.save();
             ctx.translate(floorStartX - 50, floorStartY + floorRectHeight / 2);
             ctx.rotate(-Math.PI / 2);
             ctx.fillText(`${(config.width * 100).toFixed(0)} cm`, 0, 0);
             ctx.restore();

             const rows = {};
             layout.forEach(plank => {
                 const yKey = plank.y.toFixed(5);
                 if (!rows[yKey]) rows[yKey] = [];
                 rows[yKey].push(plank);
             });
             
             const rowEntries = Object.values(rows);
             rowEntries.forEach((rowPlanks, index) => {
                if (rowPlanks.length > 0) {
                    const startPiece = rowPlanks.reduce((a, b) => (a.x < b.x ? a : b));
                    const endPiece = rowPlanks.reduce((a, b) => (a.x > b.x ? a : b));
                    const textY = floorStartY + (startPiece.y * scale) + (startPiece.height * scale) / 2;

                    ctx.fillStyle = '#c70039';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'right';
                    ctx.fillText((startPiece.width * 100).toFixed(1), floorStartX + startPiece.x * scale - 10, textY);

                    ctx.fillStyle = '#0057a8';
                    ctx.textAlign = 'left';
                    ctx.fillText((endPiece.width * 100).toFixed(1), floorStartX + (endPiece.x + endPiece.width) * scale + 10, textY);
                    
                    if (index === 0 || index === rowEntries.length - 1) {
                         const widthCmText = `${(startPiece.height * 100).toFixed(1)} cm`;
                         const textX = floorStartX + floorRectWidth / 2;
                         const textMetrics = ctx.measureText(widthCmText);
                         ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
                         ctx.fillRect(textX - textMetrics.width / 2 - 5, textY - 9, textMetrics.width + 10, 18);
                         ctx.fillStyle = 'white';
                         ctx.font = '12px Arial';
                         ctx.textAlign = 'center';
                         ctx.fillText(widthCmText, textX, textY);
                    }
                }
             });
        },
        
        drawDoor(app, config, scale, startX, startY) {
            const { ctx } = app;
            const { length, width, wallThickness } = config;
            const doorWidth = 0.9;
            const doorOffset = 0.2;
            if (length >= (doorWidth + doorOffset)) {
                const doorRectX = startX + (wallThickness + doorOffset) * scale;
                const doorRectY = startY + (width + wallThickness) * scale;
                const doorRectWidth = doorWidth * scale;
                const doorRectHeight = wallThickness * scale;

                // Draw the door opening rectangle
                ctx.fillStyle = '#f0f0f0';
                ctx.fillRect(doorRectX, doorRectY, doorRectWidth, doorRectHeight);

                // Add the text label
                ctx.fillStyle = '#333'; // Text color
                ctx.font = '12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const textX = doorRectX + doorRectWidth / 2;
                const textY = doorRectY + doorRectHeight / 2;
                ctx.fillText('門', textX, textY);
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    FlooringSimulator.init();
});