# Backend Monitoring System

## Project Overview

This project is a comprehensive monitoring system designed to track and report the status of student-developed backend applications running on local VMs within a LAN environment. The monitoring system is deployed on a public VPS and collects real-time data about API performance, system status, and task completion from student applications.

## Features

- 🔍 Real-time monitoring of student backend applications
- 📊 Dashboard visualization of application metrics
- 🔐 User authentication for instructors and students
- 📡 Automated status reporting from VM instances
- 📝 Task completion tracking and verification
- 📈 Performance metrics collection and analysis
- 🔔 Alert system for offline applications or failed APIs

## Architecture

### VPS Server (Public Internet)
- Node.js & Express.js monitoring server
- TiDB Cloud for data persistence
- Dashboard for instructors to view all student applications
- Authentication system to manage access

### Student VM Applications (LAN)
- Local Node.js applications reporting status to VPS
- Automated heartbeat system to verify online status
- API result validation and reporting
- Task completion verification

## Project Structure

```
.
├── backend
│   ├── middleware
│   │   └── auth.js           # Authentication middleware
│   ├── models
│   │   ├── Student.js        # Student data model
│   │   └── User.js           # User and instructor model
│   ├── routes
│   │   ├── auth.js           # Authentication routes
│   │   ├── dashboard.js      # Monitoring dashboard routes
│   │   └── students.js       # Student application management routes
│   ├── scripts
│   │   └── createadmin.js    # Script to create admin user
│   └── server.js             # Main server file
├── data                      # Data storage directory
├── frontend
│   ├── build                 # Production build
│   ├── public                # Static files
│   └── src
│       ├── components        # Reusable React components
│       ├── contexts          # React context providers
│       ├── pages             # Page components
│       └── ...               # Other frontend files
├── package.json              # Project dependencies and scripts
└── .gitignore                # Git ignore configuration
```

## Deployment Guide

### VPS Server Setup (For Instructors)

1. Provision a VPS with the following minimum requirements:
   - 2 CPU cores
   - 4GB RAM
   - 50GB SSD storage
   - Public IP address

2. Clone the repository:
   ```bash
   git clone <repository-url>
   cd <project-directory>
   ```

3. Install dependencies:
   ```bash
   npm install
   cd frontend
   npm install
   cd ..
   ```

4. Set up environment variables:
   Create a `.env` file with the following variables:
   ```
   DB_HOST=your-tidb-host.tidbcloud.com
   DB_PORT=4000
   DB_USER=your-username
   DB_PASSWORD=your-password
   DB_NAME=monitoring_db
   ADMIN_USERNAME=admin
   ADMIN_PASSWORD=secure_password
   JWT_SECRET=your-jwt-secret
   PORT=3000
   ```

5. Initialize the database:
   ```bash
   node backend/scripts/createadmin.js
   ```

6. Start the server:
   ```bash
   npm run start
   ```

7. Set up NGINX as a reverse proxy (recommended):
   ```bash
   sudo apt-get install nginx
   ```
   Configure NGINX to proxy requests to your Node.js server.

8. Secure the server with SSL (Let's Encrypt):
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### Student VM Setup

1. Ensure your VM meets requirements:
   - Ubuntu Server 22.04
   - 2 CPU cores
   - 4GB RAM
   - 50GB storage
   - NAT network mode

2. Configure network settings as specified in course material:
   ```bash
   sudo vim /etc/netplan/00-installer-config.yaml
   ```
   
   Apply network configuration:
   ```bash
   sudo netplan apply
   ```

3. Install Node.js:
   ```bash
   bash -c "$(curl -fsSL https://gitee.com/RubyMetric/nvm-cn/raw/main/install.sh)"
   nvm install node
   nvm use node
   ```

4. Clone the student reporting client:
   ```bash
   git clone <student-client-repo-url>
   cd <student-client-directory>
   npm install
   ```

5. Configure the client with your student information:
   Create a `.env` file with:
   ```
   STUDENT_NAME=Your Name
   STUDENT_ID=Your ID
   MONITORING_SERVER=https://monitor.example.com
   API_KEY=your-assigned-api-key
   ```

6. Start your application with monitoring enabled:
   ```bash
   npm run start
   ```

## API Endpoints

### Monitoring Server (VPS)

#### Authentication
- `POST /api/auth/login` - Instructor login
- `GET /api/auth/me` - Get current user

#### Dashboard
- `GET /api/dashboard` - Get overview of all student applications
- `GET /api/dashboard/stats` - Get aggregated statistics

#### Student Management
- `GET /api/students` - List all registered student applications
- `GET /api/students/:id` - Get specific student application details
- `PUT /api/students/:id/verify` - Manually verify a student's work

### Student Client (VM)

#### Status Reporting
- `POST /todos` - Create a todo item (monitored)
- `GET /todos` - List todo items (monitored)
- `DELETE /todos/:id` - Delete a todo item (monitored)
- `PATCH /todos/:id` - Update todo completion status (monitored)

#### Monitoring Integration
- `POST /status/heartbeat` - Send periodic heartbeat to monitoring server
- `POST /status/api-result` - Report API test results
- `POST /status/system-info` - Report system resource usage

## Monitoring Features

### For Instructors
1. **Real-time Dashboard**
   - See which student applications are online/offline
   - View API success rates and errors
   - Track task completion across all students

2. **Individual Student Reports**
   - Detailed view of each student's progress
   - API test results history
   - System resource utilization

3. **Batch Operations**
   - Send test commands to all student applications
   - Reset or restart student environments
   - Deploy updated configurations

### For Students
1. **Status Dashboard**
   - View your own application status
   - See which APIs are working correctly
   - Track your progress on assignments

2. **Automated Reporting**
   - System automatically reports API test results
   - Periodic heartbeats verify your application is online
   - Resource usage monitoring to detect issues

## Troubleshooting

### Common VPS Issues
- **Database Connection Failures**: Verify TiDB connection string and credentials
- **NGINX Configuration**: Check NGINX error logs at `/var/log/nginx/error.log`
- **SSL Certification**: Ensure Certbot has properly set up certificates

### Common VM Issues
- **Network Connectivity**: Ensure the VM can reach the VPS using `ping monitor.example.com`
- **API Reporting Failures**: Check client logs for connection timeouts
- **Authentication Issues**: Verify your API key is correctly configured

## Security Considerations

1. **API Keys**: Each student is assigned a unique API key for authentication
2. **Rate Limiting**: Monitoring requests are rate-limited to prevent abuse
3. **Data Isolation**: Student data is isolated to prevent cross-access
4. **SSL**: All communications between VMs and VPS are encrypted

## Performance Optimization

1. **Batched Reporting**: Status updates are batched to reduce network overhead
2. **Scheduled Reporting**: Non-critical metrics are reported on a schedule
3. **Compression**: Response data is compressed to reduce bandwidth

## License

This project is part of an academic course and is subject to the course's licensing terms.

## Acknowledgements

- TiDB Cloud for providing a free database tier
- Public Cloud providers for VPS hosting
- VMware for virtualization software