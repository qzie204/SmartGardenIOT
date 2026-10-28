'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { HttpError, text, password, requireObject } = require('./validation');

function publicUser(user) {
  return { id: user.id, username: user.username, profile: user.profile };
}

class AuthService {
  constructor(repository, config) {
    this.repository = repository;
    this.config = config;
  }

  async register(body) {
    requireObject(body);
    if (!this.config.allowRegistration) {
      throw new HttpError(403, 'Đăng ký đang tắt. Liên hệ người quản trị.');
    }
    const username = text(body.username, 'Tên tài khoản', 50, true).toLowerCase();
    if (!/^[a-z0-9_.-]{3,50}$/.test(username)) {
      throw new HttpError(400, 'Tài khoản cần 3–50 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.');
    }
    const secret = password(body.password);
    if (body.confirm !== undefined && body.confirm !== secret) {
      throw new HttpError(400, 'Mật khẩu nhập lại chưa khớp.');
    }
    const name = text(body.name, 'Họ tên', 100);
    const email = text(body.email, 'Email', 255);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, 'Email không hợp lệ.');
    }
    const hash = await bcrypt.hash(secret, 12);
    try {
      return publicUser(await this.repository.createUser(username, hash, name, email));
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        throw new HttpError(409, 'Tên tài khoản đã tồn tại.');
      }
      throw error;
    }
  }

  async login(body) {
    requireObject(body);
    const username = text(body.username, 'Tài khoản', 50, true).toLowerCase();
    const secret = text(body.password, 'Mật khẩu', 200, true);
    const user = await this.repository.findUser(username);
    // Hash dự phòng để tài khoản không tồn tại vẫn đi qua bước bcrypt.
    let hash = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.5kRwlz6rUoH1A0WTMysB0Z4mHuPZp9y';
    if (user) {
      hash = user.passwordHash;
    }
    const valid = await bcrypt.compare(body.password, hash);
    if (!user || !valid || !secret) {
      throw new HttpError(401, 'Tài khoản hoặc mật khẩu chưa đúng.');
    }
    const token = jwt.sign({ version: user.tokenVersion }, this.config.jwtSecret, {
      subject: String(user.id), expiresIn: '24h', algorithm: 'HS256', issuer: 'smart-garden', audience: 'smart-garden-web'
    });
    return { token, user: publicUser(user), username: user.username };
  }

  async verify(token) {
    let payload;
    try {
      payload = jwt.verify(token, this.config.jwtSecret, {
        algorithms: ['HS256'], issuer: 'smart-garden', audience: 'smart-garden-web'
      });
    } catch (_) {
      throw new HttpError(401, 'Phiên đăng nhập đã hết hạn.');
    }
    const user = await this.repository.userById(Number(payload.sub));
    if (!user || user.tokenVersion !== payload.version) {
      throw new HttpError(401, 'Phiên đăng nhập không còn hợp lệ.');
    }
    return { ...user, sessionExpiresAt: payload.exp * 1000 };
  }

  async changePassword(user, body) {
    requireObject(body);
    text(body.old_password, 'Mật khẩu hiện tại', 200, true);
    const next = password(body.new_password);
    if (!await bcrypt.compare(body.old_password, user.passwordHash)) {
      throw new HttpError(400, 'Mật khẩu hiện tại chưa đúng.');
    }
    await this.repository.changePassword(user.id, await bcrypt.hash(next, 12));
  }

  async updateProfile(user, body) {
    requireObject(body);
    const limits = { name: 100, studentId: 50, className: 50, email: 255, avatar: 499999, github: 1000, figma: 1000, postman: 1000, report: 1000 };
    const aliases = { full_name: 'name', student_id: 'studentId', class_name: 'className', avatar_url: 'avatar', github_link: 'github', figma_link: 'figma', postman_link: 'postman', report_link: 'report' };
    const profile = {};
    for (const [field, value] of Object.entries(body)) {
      let key = field;
      if (Object.hasOwn(aliases, field)) {
        key = aliases[field];
      }
      if (!Object.hasOwn(limits, key)) {
        throw new HttpError(400, 'Trường hồ sơ không hợp lệ: ' + field);
      }
      profile[key] = text(value, key, limits[key]);
      if (['github', 'figma', 'postman', 'report'].includes(key) && value) {
        let url;
        try {
          url = new URL(value);
        } catch (_) {
          throw new HttpError(400, 'Liên kết không hợp lệ.');
        }
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new HttpError(400, 'Liên kết cần bắt đầu bằng http:// hoặc https://.');
        }
      }
    }
    if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
      throw new HttpError(400, 'Email không hợp lệ.');
    }
    if (profile.avatar && !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(profile.avatar)) {
      throw new HttpError(400, 'Ảnh đại diện cần là ảnh JPG, PNG hoặc WebP đã thu nhỏ.');
    }
    return publicUser(await this.repository.saveProfile(user.id, profile));
  }
}

module.exports = { AuthService, publicUser };
