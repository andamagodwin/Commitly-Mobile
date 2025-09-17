import { awardCommitPoints } from './profileService';

export type CommitInfo = {
  sha: string;
  author: string;
  message: string;
  date: string;
  url: string;
};

/**
 * Check for new commits and award points
 * This can be called periodically or triggered by webhooks
 */
export async function checkAndAwardCommits(userId: string, githubUsername: string, lastKnownSha?: string): Promise<CommitInfo[]> {
  try {
    // Get recent commits from GitHub API
    const response = await fetch(`https://api.github.com/users/${githubUsername}/events`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(process.env.EXPO_PUBLIC_GITHUB_TOKEN ? {
          'Authorization': `Bearer ${process.env.EXPO_PUBLIC_GITHUB_TOKEN}`
        } : {})
      }
    });

    if (!response.ok) {
      console.warn('Failed to fetch GitHub events:', response.status);
      return [];
    }

    const events = await response.json();
    const pushEvents = events.filter((event: any) => event.type === 'PushEvent');
    
    const newCommits: CommitInfo[] = [];
    
    for (const event of pushEvents) {
      const commits = event.payload?.commits || [];
      
      for (const commit of commits) {
        // Skip if we've already processed this commit
        if (lastKnownSha && commit.sha === lastKnownSha) {
          break;
        }
        
        const commitInfo: CommitInfo = {
          sha: commit.sha,
          author: commit.author?.name || githubUsername,
          message: commit.message,
          date: event.created_at,
          url: commit.url
        };
        
        // Award points for this commit
        const result = await awardCommitPoints(userId, commit.sha);
        if (result) {
          newCommits.push(commitInfo);
          console.log(`✅ Awarded 25 points for commit: ${commit.message.substring(0, 50)}...`);
        }
      }
    }
    
    return newCommits;
  } catch (error) {
    console.error('Error checking commits:', error);
    return [];
  }
}

/**
 * Alternative: Award points based on contribution count increase
 * Call this when the contributions chart updates and shows new commits
 */
export async function awardPointsForContributionIncrease(
  userId: string, 
  previousTotal: number, 
  currentTotal: number
): Promise<boolean> {
  const newContributions = currentTotal - previousTotal;
  if (newContributions > 0) {
    try {
      const pointsToAward = newContributions * 25; // 25 points per contribution
      await awardCommitPoints(userId);
      console.log(`✅ Awarded ${pointsToAward} points for ${newContributions} new contributions`);
      return true;
    } catch (error) {
      console.error('Failed to award points for contributions:', error);
      return false;
    }
  }
  return false;
}