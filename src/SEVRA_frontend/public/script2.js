// Create binary code background
function createBinaryBackground() {
    const binaryBackground = document.querySelector('.binary-background') || document.createElement('div');
    binaryBackground.className = 'binary-background';
    if (!binaryBackground.parentElement) {
        document.querySelector('.ai-chat').appendChild(binaryBackground);
    }

    if (!binaryBackground.children.length) {
        const characters = ['0', '1'];
        const numberOfElements = 50;

        for (let i = 0; i < numberOfElements; i++) {
            const binaryElement = document.createElement('div');
            binaryElement.className = 'binary-element';
            binaryElement.style.left = `${Math.random() * 100}%`;
            binaryElement.style.top = `${Math.random() * 100}%`;
            binaryElement.style.fontSize = `${Math.floor(Math.random() * 20) + 10}px`;
            binaryElement.textContent = characters[Math.floor(Math.random() * 2)];
            binaryBackground.appendChild(binaryElement);
        }
    }

    return {
        element: binaryBackground,
        updateBinary: () => {
            Array.from(binaryBackground.children).forEach(el => {
                el.style.left = `${Math.random() * 100}%`;
                el.style.top = `${Math.random() * 100}%`;
            });
        }
    };
}

// Typewriter effect function
function typeWriter(element, text, delay = 30, callback) {
    element.style.opacity = '0';
    element.innerHTML = '';
    let index = 0;
    
    setTimeout(() => {
        element.style.opacity = '1';
        element.classList.add('typing-effect');

        const interval = setInterval(() => {
            if (index < text.length) {
                const char = text.charAt(index);
                const span = document.createElement('span');
                span.textContent = char;
                span.classList.add('typing-animation');
                element.appendChild(span);
                
                // Remove animation class after it completes
                setTimeout(() => {
                    span.classList.remove('typing-animation');
                }, 200);
                
                index++;
            } else {
                clearInterval(interval);
                element.classList.remove('typing-effect');
                if (callback) callback();
            }
        }, delay);
    }, delay);
}

// Auto-scroll reset for infinite loop (Container 2)
const artworksContainer = document.querySelector('.artworks');
function resetScroll() {
    const scrollWidth = artworksContainer.scrollWidth / 2; 
    const currentPosition = Math.abs(artworksContainer.getBoundingClientRect().left);

    if (currentPosition >= scrollWidth) {
        artworksContainer.style.transition = 'none'; 
        artworksContainer.style.transform = 'translateX(0)';
        void artworksContainer.offsetWidth; 
        artworksContainer.style.transition = 'transform 30s linear'; 
    }
}

// Fourth Content Function (Call Typewriter Func)
const endDescriptions = document.querySelectorAll('.End_Description');
const texts = [
    "Dunia investasi berubah.",
    "Bergabunglah dengan Sevra dan jadilah bagian dari",
    "Revolusi Kepemilikan Digital."
];
function typeEndDescriptions(index = 0) {
    if (index < endDescriptions.length) {
        endDescriptions[index].innerHTML = ''; 
        typeWriter(endDescriptions[index], texts[index], 30, () => {
            setTimeout(() => typeEndDescriptions(index + 1), 500);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');

    // Cache elements for video backgrounds
    const introSection = document.querySelector('.introduction');
    const showcaseSection = document.querySelector('.assets-showcase');
    const aiSection = document.querySelector('.ai-chat');
    const footerGroup = document.querySelector('.Footer-group'); 

    const introVideo = introSection.querySelector('.video-container');
    const showcaseVideo = showcaseSection.querySelector('.video-container');
    const footerVideo = footerGroup.querySelector('.video-container');

    function setInitialVideoVisibility() {
        const windowHeight = window.innerHeight;
        const introRect = introSection.getBoundingClientRect();
        const showcaseRect = showcaseSection.getBoundingClientRect();
        const aiRect = aiSection.getBoundingClientRect();

        const sections = [
            { section: introSection, video: introVideo, rect: introRect },
            { section: showcaseSection, video: showcaseVideo, rect: showcaseRect },
            { section: aiSection, video: null, rect: aiRect }, 
        ];

        let visibleSection = null;
        sections.forEach(({ section, video, rect }) => {
            const isVisible = rect.top < windowHeight && rect.bottom > 0; 
            if (isVisible) {
                const visibilityRatio = Math.min(rect.bottom, windowHeight) - Math.max(rect.top, 0);
                if (visibilityRatio > windowHeight * 0.5) { 
                    visibleSection = { section, video };
                }
            }
        });
        // set up 1 video to not disappear and that is the viewed one
        sections.forEach(({ section, video }) => {
            if (video) {
                video.style.opacity = (visibleSection && visibleSection.video === video) ? '1' : '0';
            }
            section.style.opacity = (visibleSection && visibleSection.section === section) ? '1' : '0';
        });
        console.log('Visible section on load:', visibleSection ? visibleSection.section.className : 'None');
    }
    setInitialVideoVisibility();

    // Container 1: ASSETS text hover effect
    const assetsHover = document.querySelector('.assets-hover');
    // Extended abstract text options
    const abstractTexts = [
        '5ASTSE', 'A$T3K$', 'ASXETZ', 'A5TRO', 'AST3RX', 'A$7EK', 'ASTR0N', 'AXT3S',
        '4$$3T$', 'A$S37S', '4$$37$', '4$T3T$', 'A57357', '$7R4T0', 'A$7R4L', 'AXY0M',
        'X4$$3T', '3$$3NC', 'QU4NT4', 'V4LU3X', 'CR¥PT0', '3TH3R', 'M3T4V$', 'T0K3N$'
    ];
    // Extended font options
    const fonts = [
        'Arial', 'Courier New', 'Georgia', 'Impact', 'Times New Roman', 'Verdana', 'Trebuchet MS', 
        'Helvetica', 'Tahoma', 'Lucida Console', 'Monaco', 'Palatino Linotype', 'Garamond', 
        'Bookman Old Style', 'Arial Black', 'Century Gothic'
    ];

    let hoverInterval;

    // Function to change the text and font continuously during hover
    function changeTextAndFont() {
        const randomText = abstractTexts[Math.floor(Math.random() * abstractTexts.length)];
        const randomFont = fonts[Math.floor(Math.random() * fonts.length)];
        assetsHover.style.fontFamily = randomFont;
        assetsHover.textContent = randomText;
    }

    assetsHover.addEventListener('mouseenter', () => {
        hoverInterval = setInterval(changeTextAndFont, 150);
    });

    assetsHover.addEventListener('mouseleave', () => {
        clearInterval(hoverInterval);
        assetsHover.style.fontFamily = 'EarthOrbiterBold';
        assetsHover.textContent = 'ASSETS';
    });

    // See more button liquid effect
    const seeMoreBtn = document.querySelector('.see-more-btn');
    
    seeMoreBtn.addEventListener('click', () => {
        const assetsSection = document.getElementById('assets');
        assetsSection.scrollIntoView({ behavior: 'smooth' });
    });

    // Smooth videos' background transition
    document.addEventListener('scroll', function () {
        const introRect = introSection.getBoundingClientRect();
        const showcaseRect = showcaseSection.getBoundingClientRect();
        const aiRect = aiSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        const showcaseTitle = showcaseSection.querySelector('.showcase-title');

        if (introRect.bottom <= windowHeight && introRect.bottom > 0) {
            introVideo.style.opacity = introRect.bottom / windowHeight;
            introSection.style.opacity = introRect.bottom / windowHeight;
        } else if (introRect.bottom <= 0) {
            introVideo.style.opacity = 0;
            introSection.style.opacity = 0;
        } else {
            introVideo.style.opacity = 1;
            introSection.style.opacity = 1;
        }
    
        if (showcaseRect.top <= windowHeight && showcaseRect.top > 0) {
            showcaseVideo.style.opacity = 1 - showcaseRect.top / windowHeight;
            showcaseSection.style.opacity = 1 - showcaseRect.top / windowHeight;
        } else if (showcaseRect.top <= 0) {
            showcaseVideo.style.opacity = 1;
            showcaseSection.style.opacity = 1;
        } else {
            showcaseVideo.style.opacity = 0;
            showcaseSection.style.opacity = 0;
            showcaseTitle.style.opacity = 0;
        }

        if (aiRect.top <= windowHeight && aiRect.top > 0) {
            aiSection.style.opacity = 1 - aiRect.top / windowHeight;
        } else if (aiRect.top <= 0) {
            aiSection.style.opacity = 1;
        } else {
            aiSection.style.opacity = 0;
        }
    });

    // Container 2: Scroll Animation
    const originalContent = artworksContainer.innerHTML;
    artworksContainer.innerHTML += originalContent;
    setInterval(resetScroll, 100);
    artworksContainer.style.transition = 'transform 60s linear';

    // Container 3: AI Chat
    const aiPill = document.querySelector('.ai-pill');
    const aiContent = document.querySelector('.ai-content');
    const aiTitle = document.querySelector('.ai-title');
    const questionsContainer = document.querySelector('.questions-container');
    const answerContainer = document.querySelector('.answer-container');

    aiContent.style.opacity = '0';

    const questions = [
        { 
            q: 'Apa itu SEVRA?', 
            a: 'SEVRA adalah platform yang memberi tokenisasi pada karya seni bernilai tinggi, memungkinkan investor memiliki sebagian kecil karya seni ikonik melalui teknologi blockchain.',
            difficulty: 'simple'
        },
        { 
            q: 'Bagaimana cara kerja aset yang diberi tokenisasi?', 
            a: 'Aset yang diberi token mengubah karya seni fisik menjadi token digital di blockchain, memungkinkan banyak investor untuk memiliki bagian dari satu karya bernilai tinggi. Setiap token mewakili kepemilikan parsial dengan semua hak dan manfaat.',
            difficulty: 'simple'
        },
        { 
            q: 'Apa manfaat yang diberikan token SEVRA?', 
            a: 'Token SEVRA memberikan kepemilikan fraksional atas karya seni bergengsi, diversifikasi portofolio, likuiditas dalam aset tradisional yang tidak likuid, dan potensi apresiasi tanpa kerumitan penyimpanan dan asuransi karya seni fisik.',
            difficulty: 'simple'
        },
        
        // Medium complexity questions
        { 
            q: 'Bagaimana SEVRA memverifikasi keaslian karya seni?', 
            a: 'SEVRA menerapkan proses otentikasi yang ketat termasuk verifikasi asal, penilaian ahli, laporan kondisi, dan sertifikasi blockchain. Setiap karya seni menjalani dokumentasi menyeluruh sebelum tokenisasi untuk memastikan keaslian mutlak.',
            difficulty: 'medium'
        },
        { 
            q: 'Tindakan keamanan apa yang melindungi investasi SEVRA?', 
            a: 'SEVRA menerapkan keamanan berlapis termasuk audit kontrak pintar, penyimpanan dingin untuk aset digital, perlindungan asuransi untuk karya seni fisik, dan teknologi buku besar terdistribusi yang mencegah perselisihan kepemilikan melalui catatan transaksi yang tidak dapat diubah.',
            difficulty: 'medium'
        },
        { 
            q: 'Bagaimana penilaian karya seni ditentukan?', 
            a: 'Penilaian karya seni menggabungkan penilaian ahli independen, analisis pasar komparatif, riwayat lelang, metrik reputasi artis, dan algoritme kepemilikan yang memperhitungkan kondisi pasar saat ini dan mengumpulkan tren untuk menetapkan nilai pasar yang wajar.',
            difficulty: 'medium'
        },
        
        // Complex questions
        { 
            q: 'Bagaimana SEVRA menavigasi kerangka peraturan secara global?', 
            a: 'SEVRA beroperasi dalam lanskap peraturan yang kompleks dengan menerapkan protokol kepatuhan spesifik yurisdiksi, verifikasi KYC/AML, kepatuhan terhadap peraturan sekuritas jika berlaku, dan melalui kemitraan hukum berkelanjutan yang beradaptasi dengan undang-undang aset digital yang terus berkembang di seluruh dunia.',
            difficulty: 'complex'
        },
        { 
            q: 'Model ekonomi apa yang memprediksi apresiasi seni yang diberi token?', 
            a: 'SEVRA employs sophisticated econometric models that analyze traditional art market cycles, blockchain asset behavior, correlation coefficients with traditional investments, liquidity premiums, and emerging collector demographics to forecast potential appreciation scenarios with confidence intervals.',
            difficulty: 'complex'
        },
        { 
            q: 'Bagaimana pengaruh kepemilikan fraksional terhadap pelestarian seni dan signifikansi budaya?', 
            a: 'Model kepemilikan revolusioner ini mendemokratisasi akses sekaligus menjaga integritas budaya melalui kontrak cerdas yang menjamin konservasi yang tepat, peluang tampilan publik, dan akses akademis. Model pemangku kepentingan terdistribusi sebenarnya meningkatkan pelestarian dengan menciptakan banyak pihak yang berinvestasi sementara tata kelola kontrak cerdas mencegah eksploitasi atau pengabaian.',
            difficulty: 'complex'
        }
    ];

    // Show AI chat interaction
    aiPill.addEventListener('click', () => {
        console.log('AI Pill clicked');
        aiPill.style.display = 'none';
        aiContent.classList.add('active');
        aiContent.style.opacity = '1';
        
        questions.forEach((item, index) => {
            const btn = document.createElement('button');
            btn.className = `question-btn ${item.difficulty}`;
            btn.textContent = item.q;
            btn.style.opacity = '0';
            
            btn.addEventListener('click', () => handleQuestionClick(item.q, item.a));
            
            questionsContainer.appendChild(btn);
            
            setTimeout(() => {
                btn.style.opacity = '1';
            }, index * 150);
        });
    });

    // Create binary background
    const binaryBg = createBinaryBackground();
    binaryBg.element.style.opacity = '0';
    binaryBg.element.style.display = 'none';

    // Handle question selection
    window.handleQuestionClick = function(selectedQuestion, answer) {
        binaryBg.element.style.display = 'block';
        setTimeout(() => {
            binaryBg.element.style.opacity = '1';
        }, 50);
        
        const binaryInterval = setInterval(() => {
            binaryBg.updateBinary();
        }, 200);
        
        aiTitle.textContent = selectedQuestion;
        aiTitle.classList.add('active');
        
        answerContainer.textContent = 'SEVRA AI is thinking';
        let dots = 0;
        const thinking = setInterval(() => {
            dots = (dots + 1) % 4;
            answerContainer.textContent = 'SEVRA AI is thinking' + '.'.repeat(dots);
        }, 300);
        
        setTimeout(() => {
            clearInterval(thinking);
            clearInterval(binaryInterval);
            
            binaryBg.element.style.opacity = '0';
            
            answerContainer.innerHTML = `<br>${answer}`;
            
            setTimeout(() => {
                binaryBg.element.style.display = 'none';
            }, 500);
            
            questionsContainer.innerHTML = '';
            questions.forEach((item, index) => {
                const btn = document.createElement('button');
                btn.className = `question-btn ${item.difficulty}`;
                btn.textContent = item.q;
                btn.style.opacity = '0';
                
                btn.addEventListener('click', () => handleQuestionClick(item.q, item.a));
                
                questionsContainer.appendChild(btn);
                
                setTimeout(() => {
                btn.style.opacity = '1';
                }, index * 150);
            });
        }, 2000);
    };

    // Observer for both container 2 and footer container
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (entry.target === showcaseSection) {
                    console.log('Showcase section in view');
                    artworksContainer.style.animationPlayState = 'running';
                } else if (entry.target === footerGroup) {
                    console.log('Footer group in view');
                    typeEndDescriptions();
                    observer.unobserve(footerGroup);
                }
            } else if (entry.target === showcaseSection) {
                artworksContainer.style.animationPlayState = 'paused';
            }
        });
    }, {
        threshold: [0.1, 0.5]
    });
    observer.observe(showcaseSection);
    observer.observe(footerGroup);

    // Smooth Scroll for Navbar
    document.querySelectorAll('.nav-button').forEach(button => {
        button.addEventListener('click', () => {
            const section = document.querySelector(`#${button.dataset.section}`);
            section.scrollIntoView({ behavior: 'smooth' });
        });
    });
    const navButtons = document.querySelectorAll('.nav-button');
    navButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const section = button.getAttribute('data-section');
            // Hanya tombol tanpa href yang akan di-scroll
            if (section && !button.getAttribute('href')) {
                e.preventDefault();
                const targetSection = document.getElementById(section);
                if (targetSection) {
                    targetSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });
});
