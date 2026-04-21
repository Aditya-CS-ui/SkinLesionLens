# LesionLens Setup Guide

## Prerequisites
- Python 3.8+
- Flask
- PyTorch
- OpenAI API key

## Local Setup

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd Lesion_Lens_skin
```

### 2. Create Environment Variables
Copy `.env.example` to `.env` and fill in your own values:

```bash
cp .env.example .env
```

Edit `.env` file with your credentials:
```
OPENAI_API_KEY=sk-your-actual-key-here
ADMIN_EMAIL=your_admin_email@example.com
ADMIN_PASS=your_secure_password_here
DOCTOR_TOKEN=your_unique_doctor_token_here
```

**⚠️ IMPORTANT:**
- **NEVER commit `.env` file to Git** - it's in `.gitignore`
- Each developer/environment should have their own `.env` file
- Change these values to something secure before deploying

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Download Model
Download `best_model.pth` from Kaggle and place it in the project root:
- File is in `.gitignore` (don't commit it)

### 5. Run the Application
```bash
python app.py
```

Server will start at `http://localhost:5000`

## Security Checklist

✅ **Before pushing to GitHub:**
- [ ] `.env` file is NOT tracked (check with `git status`)
- [ ] Never hardcode passwords in source code
- [ ] All sensitive data uses environment variables
- [ ] `.gitignore` includes `.env`, `*.pth`, `__pycache__/`

✅ **Credentials:**
- [ ] Use strong, unique passwords for `ADMIN_PASS`
- [ ] Generate a secure `DOCTOR_TOKEN` (use UUID or similar)
- [ ] Keep `OPENAI_API_KEY` secret
- [ ] Never share `.env` file or credentials via email/chat

## Accidental Secret Exposure?

If you accidentally pushed credentials:
```bash
git rm --cached .env
git commit --amend -m "Remove .env file"
git push --force-with-lease



When deploying to production (Heroku, AWS, etc.):
1. Set environment variables via platform dashboard (NOT `.env` file)
2. Example for Heroku:
   ```bash
   heroku config:set ADMIN_PASS="your_password"
   heroku config:set OPENAI_API_KEY="sk-..."
   ```

## Testing Locally

Default credentials are NOT set. You must provide your own via `.env`:
- Admin login won't work without `ADMIN_EMAIL` and `ADMIN_PASS`
- Doctor portal won't work without `DOCTOR_TOKEN`
- AI chat won't work without `OPENAI_API_KEY`

