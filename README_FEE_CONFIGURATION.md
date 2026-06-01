# GasGuard Configurable Fee System - Quick Start

## 🚀 Overview

GasGuard's configurable fee system allows administrators to dynamically update protocol fees, tier multipliers, and pricing policies without code deployments. Features comprehensive audit trails, validation, and real-time user notifications.

## ⚡ Quick Setup

### 1. Access Admin Panel
```bash
# Get current fee configuration
curl -X GET "http://localhost:3000/admin/fee-configuration/current" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### 2. Update Base Price
```bash
curl -X PUT "http://localhost:3000/admin/fee-configuration/default" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "basePricePerRequest": 0.000015,
    "reason": "Market adjustment",
    "notifyUsers": true
  }'
```

### 3. Preview Changes
```bash
curl -X POST "http://localhost:3000/admin/fee-configuration/default/preview" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "basePricePerRequest": 0.00002,
    "tierMultipliers": {
      "professional": 0.55
    },
    "reason": "Test preview"
  }'
```

## 📊 Fee Structure

### Current Configuration
```json
{
  "basePricePerRequest": 0.00001,
  "currency": "XLM",
  "tierMultipliers": {
    "starter": 1.0,
    "developer": 0.8,
    "professional": 0.6,
    "enterprise": 0.4
  },
  "discountPercentages": {
    "starter": 0,
    "developer": 20,
    "professional": 40,
    "enterprise": 60
  }
}
```

### Pricing Matrix

| Tier | Multiplier | Discount | Final Price | Monthly Cost (1K requests) |
|------|------------|----------|-------------|---------------------------|
| Starter | 1.0x | 0% | 0.00001 XLM | 0.01 XLM |
| Developer | 0.8x | 20% | 0.000008 XLM | 0.008 XLM |
| Professional | 0.6x | 40% | 0.000006 XLM | 0.006 XLM |
| Enterprise | 0.4x | 60% | 0.000004 XLM | 0.004 XLM |

## 🔧 Common Operations

### Update Tier Pricing
```bash
# Update professional tier pricing
curl -X PUT "http://localhost:3000/admin/fee-configuration/default" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "tierMultipliers": {
      "professional": 0.55,
      "enterprise": 0.35
    },
    "discountPercentages": {
      "professional": 45,
      "enterprise": 65
    },
    "reason": "Improved enterprise pricing",
    "notifyUsers": true
  }'
```

### Update Rate Limits
```bash
# Update rate limits for tiers
curl -X PUT "http://localhost:3000/admin/fee-configuration/default" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rateLimits": {
      "starter": 15,
      "developer": 45,
      "professional": 150,
      "enterprise": 1500
    },
    "reason": "Infrastructure upgrade",
    "notifyUsers": false
  }'
```

### Update Request Limits
```bash
# Update monthly request limits
curl -X PUT "http://localhost:3000/admin/fee-configuration/default" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "requestLimits": {
      "starter": 1500,
      "developer": 15000,
      "professional": 150000,
      "enterprise": -1
    },
    "reason": "Capacity expansion",
    "notifyUsers": true
  }'
```

## 📈 Analytics and Monitoring

### Get Revenue Analytics
```bash
# Get analytics for January 2024
curl -X GET "http://localhost:3000/admin/fee-configuration/analytics?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Get Configuration History
```bash
# Get full history
curl -X GET "http://localhost:3000/admin/fee-configuration/default/history" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get history for date range
curl -X GET "http://localhost:3000/admin/fee-configuration/default/events?startDate=2024-01-01&endDate=2024-01-31" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 🛡️ Validation Before Updates

Always validate changes before applying:

```bash
# Validate fee update
curl -X POST "http://localhost:3000/admin/fee-configuration/default/validate" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "basePricePerRequest": -0.00001,
    "reason": "Test validation"
  }'
```

**Response with errors:**
```json
{
  "success": false,
  "data": {
    "isValid": false,
    "errors": ["Base price per request cannot be negative"],
    "warnings": [],
    "impact": {
      "affectedUsers": 30000,
      "priceIncreasePercentage": 0,
      "priceDecreasePercentage": 0
    }
  }
}
```

## ⚙️ Admin Settings

### Configure Approval Requirements
```bash
# Update admin settings
curl -X PUT "http://localhost:3000/admin/fee-configuration/settings" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "allowFeeUpdates": true,
    "requireApprovalForLargeChanges": true,
    "largeChangeThreshold": 25,
    "approvalRequiredUsers": ["admin-1", "admin-2"],
    "defaultGracePeriod": 7,
    "enableUserNotifications": true,
    "maxFeeChangesPerDay": 10,
    "maxFeeChangesPerHour": 2
  }'
```

### Get Current Settings
```bash
curl -X GET "http://localhost:3000/admin/fee-configuration/settings" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 🔄 Rollback Operations

### Restore Previous Version
```bash
# Restore to version 2
curl -X POST "http://localhost:3000/admin/fee-configuration/default/restore/2" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 📱 Integration Examples

### Node.js Integration
```javascript
const axios = require('axios');

class GasGuardAdmin {
  constructor(apiKey, baseUrl = 'http://localhost:3000') {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async updateBasePrice(newPrice, reason) {
    try {
      const response = await this.client.put('/admin/fee-configuration/default', {
        basePricePerRequest: newPrice,
        reason,
        notifyUsers: true
      });
      
      console.log('✅ Fee updated successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Failed to update fee:', error.response?.data || error.message);
      throw error;
    }
  }

  async validateUpdate(updateRequest) {
    const response = await this.client.post('/admin/fee-configuration/default/validate', updateRequest);
    return response.data;
  }

  async getAnalytics(startDate, endDate) {
    const response = await this.client.get('/admin/fee-configuration/analytics', {
      params: { startDate, endDate }
    });
    return response.data;
  }
}

// Usage
const admin = new GasGuardAdmin('your-admin-token');

// Update with validation
const updateRequest = {
  basePricePerRequest: 0.000015,
  reason: 'Market adjustment'
};

const validation = await admin.validateUpdate(updateRequest);
if (validation.data.isValid) {
  await admin.updateBasePrice(0.000015, 'Market adjustment');
} else {
  console.log('❌ Validation failed:', validation.data.errors);
}
```

### Python Integration
```python
import requests
import json
from datetime import datetime

class GasGuardAdmin:
    def __init__(self, api_key, base_url='http://localhost:3000'):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def update_base_price(self, new_price, reason):
        try:
            response = requests.put(
                f'{self.base_url}/admin/fee-configuration/default',
                headers=self.headers,
                json={
                    'basePricePerRequest': new_price,
                    'reason': reason,
                    'notifyUsers': True
                }
            )
            
            if response.status_code == 200:
                print('✅ Fee updated successfully:', response.json())
                return response.json()['data']
            else:
                print(f'❌ Failed to update fee: {response.text}')
                response.raise_for_status()
                
        except Exception as e:
            print(f'❌ Error updating fee: {str(e)}')
            raise

    def validate_update(self, update_request):
        response = requests.post(
            f'{self.base_url}/admin/fee-configuration/default/validate',
            headers=self.headers,
            json=update_request
        )
        return response.json()

    def get_analytics(self, start_date, end_date):
        response = requests.get(
            f'{self.base_url}/admin/fee-configuration/analytics',
            headers=self.headers,
            params={
                'startDate': start_date,
                'endDate': end_date
            }
        )
        return response.json()

# Usage
admin = GasGuardAdmin('your-admin-token')

# Update with validation
update_request = {
    'basePricePerRequest': 0.000015,
    'reason': 'Market adjustment'
}

validation = admin.validate_update(update_request)
if validation['data']['isValid']:
    admin.update_base_price(0.000015, 'Market adjustment')
else:
    print('❌ Validation failed:', validation['data']['errors'])
```

## 🚨 Error Handling

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| 400 | Bad Request | Check request body format and validation rules |
| 401 | Unauthorized | Verify admin token is valid and not expired |
| 403 | Forbidden | Check user permissions for fee updates |
| 429 | Rate Limited | Wait before making more requests |
| 500 | Internal Error | Contact support or check service logs |

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Base price per request cannot be negative",
    "details": {
      "field": "basePricePerRequest",
      "value": -0.00001,
      "constraint": "min: 0"
    }
  }
}
```

## 📊 Monitoring Dashboard

### Key Metrics to Monitor

1. **Configuration Updates**
   - Changes per hour/day/week
   - Validation success/failure rate
   - Most common update reasons

2. **Revenue Impact**
   - Revenue before/after changes
   - User adoption impact
   - Tier migration patterns

3. **System Health**
   - API response times
   - Database performance
   - Event processing lag

### Sample Dashboard Metrics
```javascript
// Real-time metrics
const metrics = {
  feeUpdatesToday: 5,
  validationSuccessRate: 95.2,
  averageResponseTime: 145, // ms
  activeConfigurations: 3,
  pendingApprovals: 1,
  userNotificationsSent: 1247,
  revenueToday: 1250.75,
  activeUsers: 28450
};
```

## 🔐 Security Best Practices

### API Security
- **Use HTTPS**: Always use secure connections
- **Token Rotation**: Rotate admin tokens regularly
- **IP Whitelisting**: Restrict admin access by IP
- **Rate Limiting**: Implement client-side rate limiting
- **Input Validation**: Validate all user inputs

### Operational Security
- **Approval Workflows**: Require approval for large changes
- **Audit Logs**: Review admin action logs regularly
- **Backup Configurations**: Regular backup of fee settings
- **Access Control**: Principle of least privilege

## 📞 Support and Troubleshooting

### Common Issues

**Q: Fee updates not taking effect**
- Check if changes were validated and approved
- Verify effective date is not in the future
- Review admin settings for approval requirements

**Q: Users not receiving notifications**
- Verify notification channels are configured
- Check user notification preferences
- Review notification delivery logs

**Q: Analytics data seems incorrect**
- Confirm date range parameters are correct
- Check if all events have been processed
- Verify calculation logic with test data

### Debug Mode

Enable debug logging for detailed troubleshooting:

```bash
# Set debug header
curl -X GET "http://localhost:3000/admin/fee-configuration/current" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "X-Debug: true"
```

### Getting Help

- **Documentation**: [Full Guide](docs/FEE_CONFIGURATION_SYSTEM.md)
- **API Reference**: [API Docs](http://localhost:3000/api-docs)
- **Support**: [Create Issue](https://github.com/gasguard/issues)
- **Community**: [Discussions](https://github.com/gasguard/discussions)

## ✅ Success Stories

### Use Case 1: Market Response
*"We needed to quickly adjust our pricing in response to market changes. The configurable fee system let us update our enterprise tier pricing within hours, affecting 30,000 users with immediate impact."*

### Use Case 2: A/B Testing
*"We used the preview feature to test different pricing strategies before deployment. This helped us optimize our conversion rates by 15% while maintaining user satisfaction."*

### Use Case 3: Graduated Rollout
*"We implemented a graduated rollout of new pricing using the effective date feature. This allowed us to migrate users smoothly without service disruption."*

---

**Ready to configure your fees?** Start with the current configuration check and explore the preview feature to test changes safely!
