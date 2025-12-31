document.addEventListener('DOMContentLoaded', () => {
    // Navigation & Views
    const navHome = document.getElementById('nav-home');
    const navCreate = document.getElementById('nav-create');
    const ctaStartBtn = document.getElementById('cta-start-btn');

    const homeView = document.getElementById('home-view');
    const createView = document.getElementById('create-view');

    function showHome() {
        homeView.classList.remove('hidden');
        createView.classList.add('hidden');
    }

    function showCreate() {
        homeView.classList.add('hidden');
        createView.classList.remove('hidden');
    }

    if (navHome) navHome.addEventListener('click', (e) => { e.preventDefault(); showHome(); });
    if (navCreate) navCreate.addEventListener('click', (e) => { e.preventDefault(); showCreate(); });
    if (ctaStartBtn) ctaStartBtn.addEventListener('click', () => { showCreate(); });

    const generateBtn = document.getElementById('generate-btn');
    const loadingDiv = document.getElementById('loading');
    const bookContainer = document.getElementById('book');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const newStoryBtn = document.getElementById('new-story-btn');

    // Action Buttons
    const downloadPdfBtn = document.querySelector('.action-btn:nth-child(1)'); // Or use specific ID
    const regenerateBtn = document.querySelector('.secondary-btn:nth-child(2)');

    if (newStoryBtn) {
        newStoryBtn.addEventListener('click', () => {
            // Reset View
            document.querySelector('.input-section').classList.remove('hidden');
            document.querySelector('.preview-section').classList.remove('full-width');
            newStoryBtn.style.display = 'none';

            // Should we go back to Home or stay in Create? 
            // Usually "Create New Story" implies resetting the form in Create View.
            // Ensure Create View is visible (it should be)
            showCreate();

            // clear book
            bookContainer.innerHTML = `
                <div class="page cover-page active">
                    <div class="page-content" style="text-align: center;">
                        <h2>Your Story Awaits...</h2>
                        <p>Fill out the form to begin.</p>
                        <div class="placeholder-icon"><i class="fas fa-star"></i></div>
                    </div>
                </div>
            `;
            updateControls();
        });
    }

    let currentStoryData = null;
    let currentPageIndex = 0;

    // Attach PDF Download Handler
    // We select all buttons with 'fa-file-pdf' icon's parent to cover top and bottom buttons
    const pdfButtons = document.querySelectorAll('.action-btn, .secondary-btn');
    pdfButtons.forEach(btn => {
        if (btn.innerHTML.includes('fa-file-pdf')) {
            btn.addEventListener('click', generatePDF);
        }
    });

    generateBtn.addEventListener('click', async () => {
        const storyIdea = document.getElementById('story-idea').value;
        const cartoonStyle = document.getElementById('cartoon-style').value;
        const language = document.getElementById('language').value;
        const eduMode = document.getElementById('edu-mode').checked;

        if (!storyIdea) {
            alert('Please enter a story idea or topic!');
            return;
        }

        // UI State: Loading
        loadingDiv.classList.remove('hidden');
        generateBtn.disabled = true;
        bookContainer.style.opacity = '0.5';

        try {
            const response = await fetch('http://127.0.0.1:5000/generate_story', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    story_idea: storyIdea,
                    cartoon_style: cartoonStyle,
                    language: language,
                    edu_mode: eduMode
                })
            });

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            currentStoryData = data;

            // UI Update: Hide Input, Show Book Full Width
            document.querySelector('.input-section').classList.add('hidden');
            document.querySelector('.preview-section').classList.add('full-width');

            // Show New Story Button
            const newStoryBtn = document.getElementById('new-story-btn');
            if (newStoryBtn) newStoryBtn.style.display = 'inline-flex';

            renderBook(data);

        } catch (error) {
            console.error('Error:', error);
            alert('Failed to generate story. Please try again.');
        } finally {
            loadingDiv.classList.add('hidden');
            generateBtn.disabled = false;
            bookContainer.style.opacity = '1';
        }
    });

    function renderBook(storyData) {
        bookContainer.innerHTML = ''; // Clear existing
        currentPageIndex = 0;
        const cartoonStyle = document.getElementById('cartoon-style').value;

        // Create Pages
        // Title Page (Cover)
        const coverPage = document.createElement('div');
        coverPage.className = 'page cover-page active';
        coverPage.innerHTML = `
            <div class="page-content" style="text-align: center; width: 100%;">
                <h1 style="color: #6a5acd; font-size: 2.5rem; margin-bottom: 1rem;">${storyData.book_title}</h1>
                <p style="font-size: 1.2rem; margin-bottom: 2rem;">A magical story for you</p>
                <div style="font-size: 1rem; color: #555;">
                    <strong>Moral:</strong> ${storyData.moral_of_the_story}
                </div>
                <!-- Cover Image -->
                 <div class="page-image" style="margin-top: 2rem;">
                    <img src="https://tse1.mm.bing.net/th?q=${encodeURIComponent(storyData.book_title + ' ' + (cartoonStyle || '') + ' storybook cover recursive art')}&w=400&h=400&c=7&rs=1&p=0" alt="Cover" style="max-height: 200px; border-radius: 10px;">
                </div>
            </div>
        `;
        bookContainer.appendChild(coverPage);

        // Story Pages
        storyData.pages.forEach((page, index) => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';

            // Using Bing Images Thumbnail as a "downloaded" image
            const styleKeyword = cartoonStyle && cartoonStyle !== 'None' ? `${cartoonStyle} style` : 'vivid children storybook illustration';
            const prompt = `${page.image_prompt} ${styleKeyword}`;
            const encodedPrompt = encodeURIComponent(prompt);
            // Valid Bing Thumbnail URL pattern
            const imageUrl = `https://tse1.mm.bing.net/th?q=${encodedPrompt}&w=600&h=400&c=7&rs=1&p=0`;

            pageDiv.innerHTML = `
                <div class="page-content">
                    <div class="story-scroll-container">
                        <p class="story-text">${page.story_text}</p>
                    </div>
                    <div class="page-number">Page ${page.page_number}</div>
                </div>
                <div class="page-image">
                    <img src="${imageUrl}" alt="${page.image_prompt}" loading="lazy">
                </div>
            `;
            bookContainer.appendChild(pageDiv);
        });

        updateControls();
    }

    function updateControls() {
        const pages = bookContainer.querySelectorAll('.page');
        prevBtn.disabled = currentPageIndex === 0;
        nextBtn.disabled = currentPageIndex === pages.length - 1;
    }

    function showPage(index) {
        const pages = bookContainer.querySelectorAll('.page');
        pages.forEach(page => page.classList.remove('active'));
        if (pages[index]) {
            pages[index].classList.add('active');
            currentPageIndex = index;
            updateControls();
        }
    }

    prevBtn.addEventListener('click', () => {
        if (currentPageIndex > 0) {
            showPage(currentPageIndex - 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        const pages = bookContainer.querySelectorAll('.page');
        if (currentPageIndex < pages.length - 1) {
            showPage(currentPageIndex + 1);
        }
    });

    // Audio / Text-to-Speech Implementation
    const readAudioBtn = document.getElementById('book-read-audio-btn');
    let synth = window.speechSynthesis;
    let isSpeaking = false;

    if (readAudioBtn) {
        readAudioBtn.addEventListener('click', () => {
            if (isSpeaking) {
                synth.cancel();
                isSpeaking = false;
                readAudioBtn.innerHTML = '<i class="fas fa-volume-up"></i> Read Story Aloud';
                return;
            }

            if (!currentStoryData) {
                alert("No story generated yet!");
                return;
            }

            const utterance = new SpeechSynthesisUtterance();
            // Combine title and all pages text
            let fullText = `${currentStoryData.book_title}. ${currentStoryData.moral_of_the_story}. `;
            currentStoryData.pages.forEach(page => {
                fullText += `Page ${page.page_number}. ${page.story_text}. `;
            });

            utterance.text = fullText;

            // Attempt to select voice based on language
            const langMap = { 'Hindi': 'hi-IN', ' Telugu': 'te-IN', 'Tamil': 'ta-IN', 'English': 'en-US' };
            const selectedLang = document.getElementById('language').value;
            utterance.lang = langMap[selectedLang] || 'en-US';

            utterance.onend = () => {
                isSpeaking = false;
                readAudioBtn.innerHTML = '<i class="fas fa-volume-up"></i> Read Story Aloud';
            };

            synth.speak(utterance);
            isSpeaking = true;
            readAudioBtn.innerHTML = '<i class="fas fa-stop"></i> Stop Reading';
        });
    }

    async function generatePDF() {
        // 1. Clone the book element
        const element = document.getElementById('book');
        const clone = element.cloneNode(true);

        // 2. Add Footer to Clone
        const footerDiv = document.createElement('div');
        footerDiv.style.textAlign = 'center';
        footerDiv.style.marginTop = '20px';
        footerDiv.style.padding = '10px';
        footerDiv.style.borderTop = '1px solid #ddd';
        footerDiv.style.color = '#555';
        footerDiv.style.fontSize = '12px';
        footerDiv.innerHTML = '© 2025 All rights reserved. Developed by Venkat.';
        clone.appendChild(footerDiv);

        // 3. Prepare clone for PDF and make it VISIBLE (Overlay)
        // html2canvas struggles with hidden/offscreen elements. We show it on top.
        clone.classList.add('pdf-mode');
        clone.style.width = '800px';
        clone.style.position = 'fixed';
        clone.style.left = '50%';
        clone.style.top = '0';
        clone.style.transform = 'translateX(-50%)';
        clone.style.zIndex = '9999';
        clone.style.backgroundColor = 'white';
        clone.style.maxHeight = '100vh'; // Prevent overflow on screen, but internal is auto
        clone.style.overflowY = 'auto'; // Allow scroll if checking, but for PDF we want full height
        // actually for html2canvas we want full visible height.
        // Let's set it to absolute top 0 and let it run down.
        clone.style.position = 'absolute';
        clone.style.top = '0';
        clone.style.left = '0'; // align left or center
        clone.style.transform = 'none';
        clone.style.margin = '0 auto';
        clone.style.right = '0';

        // HIDE ORIGINAL CONTENT TEMPORARILY
        const originalMain = document.querySelector('.main-container');
        if (originalMain) originalMain.style.visibility = 'hidden';

        // FIX: Expand all scroll containers explicitly
        const scrollContainers = clone.querySelectorAll('.story-scroll-container');
        scrollContainers.forEach(container => {
            container.style.overflow = 'visible';
            container.style.height = 'auto';
            container.style.maxHeight = 'none';
            container.style.display = 'block';
        });

        document.body.appendChild(clone);

        // 4. Force Image Loading
        const images = Array.from(clone.querySelectorAll('img'));
        const imagePromises = images.map(img => {
            return new Promise((resolve) => {
                if (img.complete && img.naturalHeight !== 0) {
                    resolve();
                } else {
                    img.onload = resolve;
                    img.onerror = resolve;
                    img.crossOrigin = "Anonymous";
                    if (!img.src) resolve();
                }
            });
        });

        await Promise.all(imagePromises);

        // Wait a small moment for layout repaint
        await new Promise(r => setTimeout(r, 500));

        // 5. Generate PDF
        const opt = {
            margin: 0.2,
            filename: 'StoryNest_Magical_Story.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: true,
                windowWidth: 800,
                x: 0,
                y: 0,
                scrollY: 0
            },
            jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        try {
            await html2pdf().set(opt).from(clone).save();
        } catch (error) {
            console.error("PDF Generation Error:", error);
            alert("Failed to generate PDF. Please try again.");
        } finally {
            // 6. Cleanup
            document.body.removeChild(clone);
            if (originalMain) originalMain.style.visibility = 'visible';
        }
    }
});

