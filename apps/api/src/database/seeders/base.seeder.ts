import { DeepPartial, FindOptionsWhere, Repository } from 'typeorm';

export abstract class BaseSeeder<T extends object> {
  constructor(protected readonly repository: Repository<T>) {}

  protected abstract data(): DeepPartial<T>[];

  protected abstract where(item: DeepPartial<T>): FindOptionsWhere<T>;

  async run() {
    for (const item of this.data()) {
      const exists = await this.repository.findOne({
        where: this.where(item),
      });

      if (!exists) {
        const created = this.repository.create(item);

        await this.repository.save(created);
      }
    }

    console.log(`${this.repository.metadata.name} seeded`);
  }
}
