# Testing Data Persistence on Render

## 🧪 How to Verify Your Data Won't Get Deleted

### Step 1: Test Locally (Before Deployment)
```bash
npm run test-persistence
```
This will verify your configuration is correct.

### Step 2: Deploy to Render with Persistent Disk

#### 2.1 Add Persistent Disk in Render Dashboard:
1. Go to your Render service
2. Navigate to **"Disks"** section
3. Click **"Add Disk"**
4. Set **Mount Path**: `/var/data`
5. Set **Size**: 10GB (recommended)
6. Save the disk

#### 2.2 Set Environment Variables:
```
DB_PATH=/var/data/ajk-cleaning/db.json
NODE_ENV=production
ADMIN_EMAIL=your-email@example.com
ADMIN_PASSWORD=your-secure-password
```

#### 2.3 Deploy Your Code:
```bash
git add .
git commit -m "Add data persistence testing"
git push origin main
```

### Step 3: Test Data Persistence in Production

#### 3.1 Add Test Data:
1. Go to your deployed website
2. Submit a contact form with test data
3. Login to admin panel
4. Verify the data appears in the admin dashboard

#### 3.2 Test Restart Persistence:
1. Go to Render dashboard
2. Click **"Manual Deploy"** or **"Restart"**
3. Wait for deployment to complete
4. Check your website again
5. **Verify**: Your test data should still be there!

#### 3.3 Test Deployment Persistence:
1. Make a small change to your code
2. Push to GitHub
3. Wait for automatic deployment
4. **Verify**: Your data should still be there!

### Step 4: Monitor Database Location

#### Check Database Path in Logs:
Look for this in your Render logs:
```
Database path: /var/data/ajk-cleaning/db.json
✅ Created database directory: /var/data/ajk-cleaning
Database loaded successfully
```

#### If you see errors like:
```
❌ Failed to create database directory: /var/data/ajk-cleaning
```
**This means the persistent disk is not mounted correctly!**

### Step 5: Verify Data Persistence

#### 5.1 Check Database File:
Your database file should be at: `/var/data/ajk-cleaning/db.json`

#### 5.2 Test Multiple Operations:
1. Add several contact form submissions
2. Restart the service
3. Check if all submissions are still there
4. Add more data
5. Deploy new code
6. Check if all data persists

### 🚨 Troubleshooting

#### If Data Gets Deleted:

**Problem**: Using wrong database path
**Solution**: 
```bash
# Check your environment variables in Render
DB_PATH=/var/data/ajk-cleaning/db.json  # ✅ Correct
DB_PATH=/opt/render/project/src/submissions.db  # ❌ Wrong
```

**Problem**: Persistent disk not mounted
**Solution**: 
1. Check if disk is added in Render dashboard
2. Verify mount path is `/var/data`
3. Ensure disk has enough space

**Problem**: Permission issues
**Solution**: 
1. Check Render logs for permission errors
2. Verify disk is properly mounted
3. Contact Render support if needed

### ✅ Success Indicators

You'll know it's working when:
- ✅ Database path shows `/var/data/ajk-cleaning/db.json` in logs
- ✅ Data persists after service restart
- ✅ Data persists after code deployment
- ✅ No EISDIR errors in logs
- ✅ Database directory is created successfully

### 🔍 Quick Test Commands

```bash
# Test configuration locally
npm run test-persistence

# Validate deployment setup
npm run validate-deployment

# Setup persistent disk (production)
npm run setup-persistent-disk
```

### 📊 Expected Log Output (Success)

```
✅ SendGrid API initialized
Database path: /var/data/ajk-cleaning/db.json
✅ Created database directory: /var/data/ajk-cleaning
Database loaded successfully
=== SERVER STARTING ===
Server running on port 3000
Database path: /var/data/ajk-cleaning/db.json
```

### ❌ Error Indicators (Failure)

```
Database initialization error: Error: EISDIR: illegal operation on a directory
❌ Failed to create database directory: /var/data/ajk-cleaning
Database path /var/data/ajk-cleaning/db.json is a directory, not a file
```

If you see these errors, your persistent disk is not configured correctly!
