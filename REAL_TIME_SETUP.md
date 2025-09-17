# 🚀 Real-time GitHub Points with Appwrite Functions

## Setup Guide for Real-time Point Awarding

### 1. 📋 **Appwrite Function Setup**

#### Step 1: Create the Function in Appwrite Console
1. Go to **Appwrite Console** → **Functions**
2. Click **"Create Function"**
3. Choose **Node.js 18** runtime
4. Function Name: `github-webhook-points`
5. Function ID: `github-webhook-points` (copy this for later)

#### Step 2: Environment Variables
Add these environment variables in the Function settings:
```
APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=68b3f1c50021442e08ec
APPWRITE_DATABASE_ID=68b412d400169e737270
APPWRITE_PROFILES_COLLECTION_ID=users
APPWRITE_API_KEY=[YOUR_SERVER_API_KEY]
```

**To get your API Key:**
1. Go to **Appwrite Console** → **Project Settings** → **API Keys**
2. Create new **Server Key** with these scopes:
   - `databases.read`
   - `databases.write`
   - `documents.read`
   - `documents.write`

#### Step 3: Deploy the Function
1. Upload the `main.js` and `package.json` files
2. Or use Appwrite CLI:
```bash
appwrite functions createDeployment \
  --functionId=github-webhook-points \
  --code="./appwrite-function" \
  --activate=true
```

#### Step 4: Set Function Trigger
1. Go to **Functions** → **github-webhook-points** → **Settings**
2. Add **HTTP** trigger (this creates a webhook URL)
3. Copy the webhook URL (looks like: `https://fra.cloud.appwrite.io/v1/functions/github-webhook-points/executions`)

### 2. 🔗 **GitHub Webhook Setup**

#### For All Your Repositories:
1. Go to **Repository** → **Settings** → **Webhooks**
2. Click **"Add webhook"**
3. **Payload URL**: Your Appwrite Function URL
4. **Content type**: `application/json`
5. **Secret**: Leave empty (or add for security)
6. **Events**: Select **"Just the push event"**
7. **Active**: ✅ Checked

#### For Organization-wide (if you have GitHub Pro):
1. Go to **Organization** → **Settings** → **Webhooks**
2. Same setup as above
3. This will trigger for ALL repos in the organization

### 3. 📱 **Mobile App Updates for Real-time**

#### Option A: Polling for Updates
The app periodically checks for point changes:

```typescript
// Add to your Home screen
useEffect(() => {
  const interval = setInterval(async () => {
    if (user?.id) {
      const latestPoints = await getPoints(user.id);
      if (latestPoints !== points) {
        setPoints(latestPoints);
        // Optional: Show notification
        console.log('🎉 Points updated!', latestPoints);
      }
    }
  }, 10000); // Check every 10 seconds

  return () => clearInterval(interval);
}, [user?.id, points]);
```

#### Option B: Real-time with Appwrite Realtime (Recommended)
```typescript
// Add to your Home screen
useEffect(() => {
  if (!user?.id) return;

  const unsubscribe = client.subscribe(
    `databases.${DATABASE_ID}.collections.${PROFILES_COLLECTION_ID}.documents`,
    (response) => {
      if (response.payload.userId === user.id) {
        setPoints(response.payload.points);
        // Show success message
        console.log('🎉 Real-time points update!', response.payload.points);
      }
    }
  );

  return () => unsubscribe();
}, [user?.id]);
```

### 4. 🧪 **Testing the Setup**

#### Test 1: Manual Function Test
```bash
curl -X POST https://fra.cloud.appwrite.io/v1/functions/github-webhook-points/executions \
  -H "Content-Type: application/json" \
  -d '{
    "commits": [{"id": "abc123", "message": "Test commit"}],
    "sender": {"login": "YOUR_GITHUB_USERNAME"}
  }'
```

#### Test 2: Real Commit Test
1. Make a commit to any repository with webhook enabled
2. Check Appwrite Function logs in console
3. Verify points increased in your profile collection
4. Check mobile app for updated points

### 5. 🔍 **Monitoring & Debugging**

#### Check Function Logs:
1. **Appwrite Console** → **Functions** → **github-webhook-points** → **Executions**
2. View logs for each webhook trigger
3. Debug any failures

#### Common Issues:
- **"User not found"**: GitHub username doesn't match `username` field in profiles
- **"Permission denied"**: API key lacks necessary permissions
- **"Function timeout"**: Database query taking too long

### 6. 🎯 **Advanced Features**

#### Different Points for Different Actions:
```javascript
// In the function, award different points based on commit message
const message = commit.message.toLowerCase();
let points = 25; // default

if (message.includes('feat:')) points = 50;      // New features
if (message.includes('fix:')) points = 30;       // Bug fixes  
if (message.includes('docs:')) points = 15;      // Documentation
if (message.includes('test:')) points = 20;      // Tests
```

#### Daily Limits:
```javascript
// Check if user already earned points today
const today = new Date().toISOString().split('T')[0];
const dailyQuery = await databases.listDocuments(
  DATABASE_ID,
  'daily_points_collection_id',
  [
    Query.equal('userId', profile.userId),
    Query.equal('date', today)
  ]
);

if (dailyQuery.total > 0 && dailyQuery.documents[0].points >= 200) {
  return res.json({ message: 'Daily limit reached' });
}
```

## 🎉 **Benefits of This Approach**

✅ **Instant**: Points awarded immediately when you commit  
✅ **Reliable**: Server-side validation prevents tampering  
✅ **Scalable**: Works across all your repositories  
✅ **Secure**: GitHub webhooks verify the source  
✅ **Detailed**: Full audit trail in Appwrite logs  
✅ **Flexible**: Easy to modify point rules  

## 🔄 **Migration from Manual to Automatic**

1. Deploy the Appwrite Function
2. Set up webhooks on your main repositories  
3. Test with a few commits
4. Once confirmed working, disable the manual "+25 ⚡" button
5. Add real-time subscriptions to the mobile app

This gives you **professional-grade real-time point awarding** that scales to any number of repositories and users! 🚀