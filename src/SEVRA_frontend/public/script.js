document.querySelector('video').playbackRate = 0.7;

//Scrolling Javascript Logic
let isScrolling = false;
const contentGroups = document.querySelectorAll('.First-Content-group, .Second-Content-group, .Third-Content-group, .Fourth-Content-group');

window.addEventListener('wheel', (e) => {
    if (isScrolling) return;

    e.preventDefault();
    isScrolling = true;

    const currentSection = Array.from(contentGroups).find(section => {
        const rect = section.getBoundingClientRect();
        return rect.top >= -100 && rect.top <= 100;
    });

    if (currentSection) {
        const delta = e.deltaY > 0 ? 1 : -1;
        const currentIndex = Array.from(contentGroups).indexOf(currentSection);
        const nextIndex = currentIndex + delta;
        const nextSection = contentGroups[nextIndex];

        if (nextSection) {
            nextSection.scrollIntoView({ behavior: 'smooth' });

            clearTimeout(window.scrollTimeout); 
            window.scrollTimeout = setTimeout(() => {
                isScrolling = false;
            }, 1000); 
        } else {
            isScrolling = false;
        }
    } else {
        isScrolling = false;
    }
}, { passive: false });

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

// Custom Typewriter effect for unownable text
const unownableContainer = document.querySelector('.unownable-text');
const unownableTexts = document.querySelectorAll('.unownable-text .text');
const unownableCursors = document.querySelectorAll('.unownable-text .cursor');
const Words = ["OWN", "THE", "UNOWNABLE"];
function typeWriteUnownable(delayStart = 2000, delayBetweenWords = 100) {
    console.log('typeWriteUnownable running');

    // Initial state
    unownableContainer.style.opacity = '1';
    unownableTexts.forEach(text => {
        text.style.opacity = '0';
        text.style.width = '0';
    });
    unownableCursors.forEach(cursor => {
        cursor.style.opacity = '0'
    });

    setTimeout(() => {
        console.log('Fading in container');
        unownableContainer.style.opacity = '1';

        let currentIndex = 0;
        let blinkInterval = null;

        function startBlink(cursor) {
            cursor.style.visibility = 'visible';
            let isVisible = true;
            blinkInterval = setInterval(() => {
                cursor.style.opacity = isVisible ? '1' : '0';
                isVisible = !isVisible;
            }, 500);
            return blinkInterval;
        }

        function stopBlink() {
            if (blinkInterval) {
                clearInterval(blinkInterval);
                blinkInterval = null;
            }
        }

        function typeNextWord() {
            if (currentIndex >= Words.length) {
                startBlink(unownableCursors[2]);
                return
            };

            const span = unownableTexts[currentIndex];
            const cursor = unownableCursors[currentIndex];
            let charIndex = 0;

            console.log(`Typing ${Words[currentIndex]} at index ${currentIndex}`);
            span.style.opacity = '1';
            stopBlink();
            startBlink(cursor);

            const interval = setInterval(() => {
                if (charIndex < Words[currentIndex].length) {
                    span.textContent = Words[currentIndex].slice(0, charIndex + 1);
                    span.style.width = 'auto';
                    charIndex++;
                } else {
                    clearInterval(interval);
                    console.log(`Finished typing ${Words[currentIndex]}`);

                    if (currentIndex < 2) {
                        console.log(`Hiding cursor after ${Words[currentIndex]}`);
                        stopBlink();
                        unownableCursors[currentIndex].style.opacity = '0';
                    }
                    currentIndex++;
                    setTimeout(typeNextWord, delayBetweenWords);
                }
            }, 50);
        }

        typeNextWord();
    }, delayStart);
}

// Third Content Function (Turning Left-Right)
const square = document.querySelector('.center-square');
const contentItems = document.querySelectorAll('.square-content-item');
const prevBtn = document.querySelector('.square-nav.prev');
const nextBtn = document.querySelector('.square-nav.next');
const sectionNumber = document.querySelector('.third-section-number');
const centerSquare = document.querySelector('.center-square');
const thirdContentGroup = document.querySelector('.Third-Content-group');
const proximityThreshold = 300;
let currentIndex = 0;

function updateSectionNumber() {
    sectionNumber.textContent = (currentIndex + 1).toString();
    sectionNumber.setAttribute('data-number', (currentIndex + 1).toString());
    sectionNumber.classList.remove('active');
    void sectionNumber.offsetWidth;
    sectionNumber.classList.add('active');
}

function updateContent(direction) {
    square.classList.add('fade-out');
    setTimeout(() => {
        contentItems[currentIndex].classList.remove('active');
        if (direction === 'next') {
            currentIndex = (currentIndex + 1) % contentItems.length;
        } else {
            currentIndex = (currentIndex - 1 + contentItems.length) % contentItems.length;
        }
        contentItems[currentIndex].classList.add('active');
        updateSectionNumber();
        setTimeout(() => {
            square.classList.remove('fade-out');
        }, 100);
    }, 300);
}

thirdContentGroup.addEventListener('mousemove', (e) => {
    if (!centerSquare || !sectionNumber) return;

    const rect = thirdContentGroup.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const rotateY = ((e.clientX - centerX) / (rect.width / 2)) * 5; 
    const rotateX = ((e.clientY - centerY) / (rect.height / 2)) * -5; 

    if (isMouseNearBox(e, centerSquare, proximityThreshold)) {
        centerSquare.classList.add('moving');
        centerSquare.style.setProperty('--rotate-y', `${rotateY}deg`);
        centerSquare.style.setProperty('--rotate-x', `${rotateX}deg`);
    } else {
        centerSquare.classList.remove('moving');
        centerSquare.style.setProperty('--rotate-y', '0deg');
        centerSquare.style.setProperty('--rotate-x', '0deg');
    }

    if (sectionNumber.classList.contains('active')) {
        sectionNumber.classList.add('moving');
        sectionNumber.style.setProperty('--rotate-y', `${rotateY}deg`);
        sectionNumber.style.setProperty('--rotate-x', `${rotateX}deg`);
    }
});

thirdContentGroup.addEventListener('mouseleave', () => {
    if (centerSquare) {
        centerSquare.classList.remove('moving');
        centerSquare.style.setProperty('--rotate-y', '0deg');
        centerSquare.style.setProperty('--rotate-x', '0deg');
    }
    if (sectionNumber) {
        sectionNumber.classList.remove('moving');
        sectionNumber.style.setProperty('--rotate-y', '0deg');
        sectionNumber.style.setProperty('--rotate-x', '0deg');
    }
});

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

//DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', function() {
    const title = document.getElementById('mainTitle');
    title.style.opacity = '1';

    // Go to Top Function on Sevra Logo
    const backToTopButton = document.querySelector('#homeButton');
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
    
    // Subtitle typewriter
    const subtitle = document.getElementById('subtitle');
    const subtitleText = "Sentuhan estetika dan keanggunan, kini menjadi bagian Anda.";
    typeWriter(subtitle, subtitleText, 10);

    // Calling the UNOWNABLE Text function above
    typeWriteUnownable(2000, 500);

    // Second Container Group's Animation and Observer
    const Second_observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
                if (entry.target.classList.contains('Second-Content-Title')) {
                    const title = entry.target;
                    title.innerHTML = '';
                    typeWriter(title, "Timeless Masterpieces, Redefined by Ownership.", 50, () => {
                        setTimeout(() => {
                            document.querySelectorAll('.square').forEach(square => {
                                square.classList.add('animate');
                            });
                        }, 1000); 
                    });
                    Second_observer.unobserve(title);
                } else {
                    entry.target.classList.add('animate');
                }
            } else {
                // When the element leaves view, reset animations
                entry.target.classList.remove('animate');
                if (!entry.target.classList.contains('Second-Content-Title')) {
                    entry.target.classList.remove('animate');
                }
            }
        });
    }, { threshold: 0.5 });

    // Observe both the title and squares
    const Second_title = document.querySelector('.Second-Content-Title');
    const squares = document.querySelectorAll('.square');
    
    Second_observer.observe(Second_title);
    squares.forEach(square => {
        Second_observer.observe(square);
    });

    // Content 3's caller
    if (contentItems.length > 0) {
        contentItems[0].classList.add('active');
        sectionNumber.classList.add('active');
        updateSectionNumber();
    }
    prevBtn.addEventListener('click', () => updateContent('prev'));
    nextBtn.addEventListener('click', () => updateContent('next'));

    contentGroups.forEach((group, index) => {
        const number = document.createElement('div');
        number.className = 'section-number';
        number.textContent = (index + 1).toString();
        number.style.opacity = '0';
        group.appendChild(number);
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    number.style.opacity = '0.05';
                    number.style.animation = 'numberAppear 1s forwards';
                }
            });
        }, { threshold: 0.3 });
        observer.observe(group);
    });

    // Fourth Content Effect Functionality
    // Trigger TypeWriting Effect in Fouth Content when Fourth-Content-group is in view
    const fourthContent = document.querySelector('.Fourth-Content-group');
    const Fourth_observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                typeEndDescriptions(); 
                Fourth_observer.unobserve(fourthContent);
            }
        });
    }, { threshold: 0.5 });
    Fourth_observer.observe(fourthContent);
    
    // Observe elements
    document.querySelectorAll('.Second-Content-Title, .square').forEach(el => {
        Second_observer.observe(el);
    });
});

// When the mouse is near the square for container 3
function isMouseNearBox(event, element, threshold) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const mouseX = event.clientX;
    const mouseY = event.clientY;
    const nearLeft = rect.left - threshold;
    const nearRight = rect.right + threshold;
    const nearTop = rect.top - threshold;
    const nearBottom = rect.bottom + threshold;
    return (
        mouseX >= nearLeft &&
        mouseX <= nearRight &&
        mouseY >= nearTop &&
        mouseY <= nearBottom
    );
}

// Reset rotation when mouse leaves
document.querySelector('.Third-Content-group').addEventListener('mouseleave', () => {
    if (!centerSquare) return;
    centerSquare.classList.remove('moving');
});

// Fix for the "Sevra. Miliki warisan, kendalikan nilai." text placement
document.addEventListener('DOMContentLoaded', function() {
    // Add background section numbers
    const contentGroups = document.querySelectorAll('.First-Content-group, .Second-Content-group, .Third-Content-group, .Fourth-Content-group');
    contentGroups.forEach((group, index) => {
        const number = document.createElement('div');
        number.className = 'section-number';
        number.textContent = (index + 1).toString();
        number.style.opacity = '0';
        group.appendChild(number);
        
        // Animate number when section comes into view
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    number.style.opacity = '0.05';
                    number.style.animation = 'numberAppear 1s forwards';
                }
            });
        }, { threshold: 0.3 });
        
        observer.observe(group);
    });
    
    // Enhanced square hover effects
    const squares = document.querySelectorAll('.square');
    squares.forEach((square, index) => {
        square.addEventListener('mouseenter', () => {
            // Add glowing effect to the corresponding image
            square.style.boxShadow = '0 0 30px rgba(0, 255, 255, 0.6)';
        });
        
        square.addEventListener('mouseleave', () => {
            // Remove glowing effect
            square.style.boxShadow = '';
        });
    });
});

// Add number appear animation
const style = document.createElement('style');
style.textContent = `
@keyframes numberAppear {
    0% { opacity: 0; transform: perspective(1000px) rotateX(30deg) translateY(50px); }
    100% { opacity: 0.05; transform: perspective(1000px) rotateX(30deg) translateY(0); }
}
`;
document.head.appendChild(style);

document.querySelectorAll('.First-Content-group, .Second-Content-group, .Third-Content-group, .Fourth-Content-group').forEach(section => {
    section.addEventListener('wheel', (e) => {
        e.preventDefault();
        const nextSection = e.deltaY > 0 ? 
            section.nextElementSibling : 
            section.previousElementSibling;
        if (nextSection) {
            nextSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
                inline: 'start',
                duration: 2000
            });
            setTimeout(() => {
                isScrolling = false;
            }, 2000);
        } else {
            isScrolling = false;
        }
    });
});