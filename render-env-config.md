# Render Environment Configuration

## Required Environment Variables for Render Deployment

Set these environment variables in your Render dashboard:

### Database Configuration
```
DB_PATH=/var/data/ajk-cleaning/db.json
```

**IMPORTANT:** 
- Do NOT use `/opt/render/project/src/submissions.db` as it conflicts with an existing directory
- Use `/var/data/ajk-cleaning/db.json` for persistent storage that survives deployments and restarts
- Make sure you have a persistent disk mounted at `/var/data` in your Render service

### Server Configuration
```
NODE_ENV=production
PORT=3000
```

### Admin Authentication
```
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=your-secure-password
```

### Email Configuration (SendGrid)
```
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
```

### Session Configuration
```
SESSION_SECRET=your-super-secret-session-key-here
```

## How to Set Up Persistent Storage on Render

### Step 1: Add a Persistent Disk
1. Go to your Render dashboard
2. Select your web service
3. Go to the "Disks" section
4. Click "Add Disk"
5. Set the mount path to `/var/data`
6. Set the size (recommended: 10GB for starter)
7. Save the disk configuration

### Step 2: Set Environment Variables
1. Go to the "Environment" tab
2. Add each variable with its value (see below)
3. Save the configuration
4. Redeploy your service

## Troubleshooting

### If you get the `EISDIR` error:
1. Make sure `DB_PATH` is set to `/var/data/ajk-cleaning/db.json`
2. Do NOT use any path that ends with `submissions.db`
3. Ensure you have a persistent disk mounted at `/var/data`

### If your data gets deleted on restart:
1. Make sure you're using the persistent disk path `/var/data/ajk-cleaning/db.json`
2. Verify the persistent disk is properly mounted
3. Check that the disk has enough space

## Validation

Run the validation script to check your configuration:
```bash
npm run validate-deployment
```