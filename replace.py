import re
path = r'c:\Users\raiya\OneDrive\Desktop\codes\vibe coding\retro-portfolio\index.html'

with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

new_projs = '''<h1 id="projects">Projects</h1>
        <hr />
        <h2>Elecsyn (AI Multisim Automation Agent)</h2>
        <ul class="skills"><li>Python</li><li>pywinauto</li><li>Google Gemini API</li></ul>
        <p>Uses Google Gemini 2.5 Pro to generate SPICE netlists from prompts.</p>
        <hr />
        <h2>Potato Disease Detection System</h2>
        <ul class="skills"><li>Python</li><li>CNN</li><li>Streamlit</li></ul>
        <p>AI-powered web application classifying potato leaf diseases.</p>
        <hr />
        <h2>OrbiSense</h2>
        <ul class="skills"><li>Python</li><li>Skyfield</li></ul>
        <p>Interactive satellite tracking suite using Skyfield SGP4.</p>
        <hr />
        <h2>Diabetes Risk Classifier</h2>
        <ul class="skills"><li>Python</li><li>Machine Learning</li></ul>
        <p>GUI Prediction App for diabetes risk forecasting.</p>
        <hr />
        <h2>Charged Particle Orbit Simulation</h2>
        <ul class="skills"><li>Julia</li><li>Physics</li></ul>
        <p>Simulating charged particles using numerical integration.</p>
      </section>

      <section>
        <h1 id="contact">Contact</h1>'''

text = re.sub(r'<h1 id="projects">Projects</h1>.*?</section>\s*<section>\s*<h1 id="contact">Contact</h1>', new_projs, text, flags=re.DOTALL)

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print("Done replacing projects")
