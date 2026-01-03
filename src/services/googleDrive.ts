import { googleAuth } from './googleAuth';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API_BASE = 'https://www.googleapis.com/upload/drive/v3';

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  createdTime: string;
  modifiedTime: string;
  appProperties?: Record<string, string>;
}

export interface DriveFileContent {
  metadata: DriveFile;
  content: Uint8Array;
}

class GoogleDriveService {
  /**
   * List files in appDataFolder
   */
  async listFiles(query?: string): Promise<DriveFile[]> {
    const token = await googleAuth.ensureValidToken();
    
    const params = new URLSearchParams({
      spaces: 'appDataFolder',
      fields: 'files(id, name, mimeType, size, createdTime, modifiedTime, appProperties)',
      pageSize: '1000',
    });

    if (query) {
      params.set('q', query);
    }

    const response = await fetch(`${DRIVE_API_BASE}/files?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to list files: ${response.statusText}`);
    }

    const data = await response.json();
    return data.files || [];
  }

  /**
   * Get file by ID
   */
  async getFile(fileId: string): Promise<DriveFile> {
    const token = await googleAuth.ensureValidToken();
    
    const params = new URLSearchParams({
      fields: 'id, name, mimeType, size, createdTime, modifiedTime, appProperties',
    });

    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Download file content
   */
  async downloadFile(fileId: string): Promise<Uint8Array> {
    const token = await googleAuth.ensureValidToken();
    
    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}?alt=media`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  /**
   * Download file with metadata
   */
  async downloadFileWithMetadata(fileId: string): Promise<DriveFileContent> {
    const [metadata, content] = await Promise.all([
      this.getFile(fileId),
      this.downloadFile(fileId),
    ]);

    return { metadata, content };
  }

  /**
   * Upload new file to appDataFolder
   */
  async uploadFile(
    name: string,
    content: Uint8Array,
    mimeType: string = 'application/octet-stream',
    appProperties?: Record<string, string>
  ): Promise<DriveFile> {
    const token = await googleAuth.ensureValidToken();

    const metadata = {
      name,
      mimeType,
      parents: ['appDataFolder'],
      appProperties,
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartBody = 
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}\r\n` +
      'Content-Transfer-Encoding: base64\r\n\r\n' +
      this.arrayBufferToBase64(content) +
      closeDelimiter;

    const response = await fetch(`${UPLOAD_API_BASE}/files?uploadType=multipart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    return await response.json();
  }

  /**
   * Update existing file content and/or metadata
   */
  async updateFile(
    fileId: string,
    content?: Uint8Array,
    metadata?: Partial<Pick<DriveFile, 'name' | 'appProperties'>>
  ): Promise<DriveFile> {
    const token = await googleAuth.ensureValidToken();

    if (content) {
      // Update with content using multipart
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;

      const multipartBody = 
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata || {}) +
        delimiter +
        'Content-Type: application/octet-stream\r\n' +
        'Content-Transfer-Encoding: base64\r\n\r\n' +
        this.arrayBufferToBase64(content) +
        closeDelimiter;

      const response = await fetch(`${UPLOAD_API_BASE}/files/${fileId}?uploadType=multipart`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      });

      if (!response.ok) {
        throw new Error(`Failed to update file: ${response.statusText}`);
      }

      return await response.json();
    } else if (metadata) {
      // Update only metadata
      const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metadata),
      });

      if (!response.ok) {
        throw new Error(`Failed to update file metadata: ${response.statusText}`);
      }

      return await response.json();
    } else {
      throw new Error('Either content or metadata must be provided');
    }
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string): Promise<void> {
    const token = await googleAuth.ensureValidToken();
    
    const response = await fetch(`${DRIVE_API_BASE}/files/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }

  /**
   * Search files by name pattern
   */
  async findFilesByName(namePattern: string): Promise<DriveFile[]> {
    const query = `name contains '${namePattern.replace(/'/g, "\\'")}'`;
    return this.listFiles(query);
  }

  /**
   * Search files by app property
   */
  async findFilesByProperty(key: string, value: string): Promise<DriveFile[]> {
    const query = `appProperties has { key='${key}' and value='${value}' }`;
    return this.listFiles(query);
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota(): Promise<{ usage: number; limit: number }> {
    const token = await googleAuth.ensureValidToken();
    
    const response = await fetch(`${DRIVE_API_BASE}/about?fields=storageQuota`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get storage quota: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      usage: parseInt(data.storageQuota?.usage || '0'),
      limit: parseInt(data.storageQuota?.limit || '0'),
    };
  }

  /**
   * Convert Uint8Array to base64 string
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const len = buffer.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }
}

// Export singleton instance
export const googleDrive = new GoogleDriveService();
