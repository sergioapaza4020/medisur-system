import { MigrationInterface, QueryRunner } from 'typeorm';

export class GenerateInitialTables1791261818129 implements MigrationInterface {
  name = 'GenerateInitialTables1791261818129';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "permissions" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_permission" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, CONSTRAINT "UQ_48ce552495d14eae9b187bb6716" UNIQUE ("name"), CONSTRAINT "PK_b2d9f24eee3188e59bd9754951d" PRIMARY KEY ("id_permission"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "roles" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_role" SERIAL NOT NULL, "name" character varying NOT NULL, "description" character varying, CONSTRAINT "UQ_648e3f5447f725579d7d4ffdfb7" UNIQUE ("name"), CONSTRAINT "PK_3ebdb96dd6787bda0e3c8f89d66" PRIMARY KEY ("id_role"))`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_sessions_revoked_reason_enum" AS ENUM('Sesión cerrada por el usuario', 'Sesión cerrada en todos los dispositivos', 'Contraseña cambiada', 'Actividad sospechosa detectada', 'Sesión cerrada por un administrador', 'Sesión expirada')`,
    );
    await queryRunner.query(
      `CREATE TABLE "user_sessions" ("id_session" SERIAL NOT NULL, "refresh_token" character varying NOT NULL, "ip_address" character varying, "user_agent" character varying, "browser" character varying, "os" character varying, "device" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "expires_at" TIMESTAMP NOT NULL, "last_used_at" TIMESTAMP, "revoked_at" TIMESTAMP, "revoked_reason" "public"."user_sessions_revoked_reason_enum", "is_active" boolean NOT NULL DEFAULT true, "id_user" integer, "revoked_by" integer, CONSTRAINT "PK_f7f3780fd0c0e292f0edb89a8a7" PRIMARY KEY ("id_session"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "users" ("is_active" boolean NOT NULL DEFAULT true, "created_by" integer, "updated_by" integer, "deleted_by" integer, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP, "id_user" SERIAL NOT NULL, "email" character varying NOT NULL, "password" character varying NOT NULL, "avatar" character varying, "username" character varying NOT NULL, "name" character varying NOT NULL, "lastname" character varying NOT NULL, "ci" character varying NOT NULL, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username"), CONSTRAINT "UQ_eff3cf686729ac337fe991de64f" UNIQUE ("ci"), CONSTRAINT "PK_fbb07fa6fbd1d74bee9782fb945" PRIMARY KEY ("id_user"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "role_permission" ("rolesIdRole" integer NOT NULL, "permissionsIdPermission" integer NOT NULL, CONSTRAINT "PK_fe4c7fdc2c72d6a49f3138bf1ef" PRIMARY KEY ("rolesIdRole", "permissionsIdPermission"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4af7dc143bdebf60de76e0e6ca" ON "role_permission" ("rolesIdRole") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4fd3525447b76b02d05ee093f5" ON "role_permission" ("permissionsIdPermission") `,
    );
    await queryRunner.query(
      `CREATE TABLE "user_role" ("usersIdUser" integer NOT NULL, "rolesIdRole" integer NOT NULL, CONSTRAINT "PK_665cecf575bd0f93c35916d8180" PRIMARY KEY ("usersIdUser", "rolesIdRole"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ef640ef7aff3f8906cf491d86b" ON "user_role" ("usersIdUser") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ea475ad8fbe80b72a241944e5d" ON "user_role" ("rolesIdRole") `,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_18233b5b7696c22f6d716fd3b26" FOREIGN KEY ("id_user") REFERENCES "users"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_dea1c3e861a8b7a8acba6e9c3c5" FOREIGN KEY ("revoked_by") REFERENCES "users"("id_user") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission" ADD CONSTRAINT "FK_4af7dc143bdebf60de76e0e6ca0" FOREIGN KEY ("rolesIdRole") REFERENCES "roles"("id_role") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission" ADD CONSTRAINT "FK_4fd3525447b76b02d05ee093f55" FOREIGN KEY ("permissionsIdPermission") REFERENCES "permissions"("id_permission") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_ef640ef7aff3f8906cf491d86bb" FOREIGN KEY ("usersIdUser") REFERENCES "users"("id_user") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" ADD CONSTRAINT "FK_ea475ad8fbe80b72a241944e5de" FOREIGN KEY ("rolesIdRole") REFERENCES "roles"("id_role") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT "FK_ea475ad8fbe80b72a241944e5de"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_role" DROP CONSTRAINT "FK_ef640ef7aff3f8906cf491d86bb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission" DROP CONSTRAINT "FK_4fd3525447b76b02d05ee093f55"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permission" DROP CONSTRAINT "FK_4af7dc143bdebf60de76e0e6ca0"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_dea1c3e861a8b7a8acba6e9c3c5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_18233b5b7696c22f6d716fd3b26"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_ea475ad8fbe80b72a241944e5d"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_ef640ef7aff3f8906cf491d86b"`);
    await queryRunner.query(`DROP TABLE "user_role"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4fd3525447b76b02d05ee093f5"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_4af7dc143bdebf60de76e0e6ca"`);
    await queryRunner.query(`DROP TABLE "role_permission"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TABLE "user_sessions"`);
    await queryRunner.query(`DROP TYPE "public"."user_sessions_revoked_reason_enum"`);
    await queryRunner.query(`DROP TABLE "roles"`);
    await queryRunner.query(`DROP TABLE "permissions"`);
  }
}
