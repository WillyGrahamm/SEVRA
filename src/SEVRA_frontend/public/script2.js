// Create binary code background
function createBinaryBackground() {
    const aiChatSection = document.querySelector('.ai-chat');
    
    const binaryBackground = document.createElement('div');
    binaryBackground.className = 'binary-background';
    aiChatSection.appendChild(binaryBackground);
    
    const generateBinaryElements = () => {
    const characters = ['0', '1'];
    const numberOfElements = 50;
    
    binaryBackground.innerHTML = '';
    
    for (let i = 0; i < numberOfElements; i++) {
        const binaryElement = document.createElement('div');
        binaryElement.className = 'binary-element';
        
        // Random position
        binaryElement.style.left = `${Math.random() * 100}%`;
        binaryElement.style.top = `${Math.random() * 100}%`;
        
        // Random size
        const size = Math.floor(Math.random() * 20) + 10;
        binaryElement.style.fontSize = `${size}px`;
        
        // Random character
        binaryElement.textContent = characters[Math.floor(Math.random() * characters.length)];
        
        // Random opacity
        binaryElement.style.opacity = Math.random() * 0.5 + 0.1;
        
        binaryBackground.appendChild(binaryElement);
    }
    };
    
    generateBinaryElements();
    
    return {
    element: binaryBackground,
    updateBinary: generateBinaryElements
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

    // Container 2: Scroll Animation
    const showcaseSection = document.querySelector('.assets-showcase');

    const originalContent = artworksContainer.innerHTML;
    artworksContainer.innerHTML += originalContent; 

    // if viewed it start..
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                artworksContainer.style.animationPlayState = 'running';
            } else {
                artworksContainer.style.animationPlayState = 'paused';
            }
        });
    }, {
        threshold: 0.1 
    });

    observer.observe(showcaseSection);

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

    // Trigger TypeWriting Effect in Footer Content when Footer Group is in view
    const FooterGroup = document.querySelector('.Footer-group');
    const Fourth_observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                typeEndDescriptions(); 
                Fourth_observer.unobserve(FooterGroup);
            }
        });
    }, { threshold: 0.5 });
    Fourth_observer.observe(FooterGroup);

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
