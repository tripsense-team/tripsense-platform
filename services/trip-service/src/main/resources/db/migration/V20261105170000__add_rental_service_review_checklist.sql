-- Add review checklist templates for RENTAL_SERVICE
INSERT INTO partner_review_checklist(id, kind, region, version, items_json, effective_at)
VALUES 
  ('CHK-RENTAL-V1', 'RENTAL_SERVICE', 'GLOBAL', '1.0',
   '[{"code":"PROFILE","required":true,"label":"Đối soát thông tin cơ sở và danh mục phương tiện / thiết bị cho thuê"},{"code":"CONTACT","required":true,"label":"Xác minh hotline, địa chỉ cửa hàng hoặc khu vực giao xe"},{"code":"OWNERSHIP","required":true,"label":"Đối soát giấy phép kinh doanh hoặc giấy đăng ký xe / minh chứng sở hữu"}]'::jsonb, now()),
  ('CHK-RENTAL_SERVICE-V1', 'RENTAL_SERVICE', 'GLOBAL', '1.0',
   '[{"code":"PROFILE","required":true,"label":"Đối soát thông tin cơ sở và danh mục phương tiện / thiết bị cho thuê"},{"code":"CONTACT","required":true,"label":"Xác minh hotline, địa chỉ cửa hàng hoặc khu vực giao xe"},{"code":"OWNERSHIP","required":true,"label":"Đối soát giấy phép kinh doanh hoặc giấy đăng ký xe / minh chứng sở hữu"}]'::jsonb, now())
ON CONFLICT (id, version) DO NOTHING;
